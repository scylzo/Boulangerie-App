import { create } from 'zustand';
import { collection, addDoc, getDocs, getCountFromServer, query, where, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export type ModePaiement = 'espece' | 'om' | 'wave';
export type TypeCommande = 'sur_place' | 'emporter' | 'livraison';
export type TypeTicket = 'vente' | 'retour';

export interface LigneTicket {
  produitId: string;
  nom: string;
  prixUnitaire: number;
  quantite: number;
}

export interface TicketPOS {
  id?: string;
  numero: number;            // n° de ticket du jour
  date: string;              // yyyy-mm-dd
  createdAt: Date;
  lignes: LigneTicket[];
  sousTotal?: number;        // total avant remise
  remise?: number;           // montant remisé en FCFA
  total: number;             // total après remise
  nbArticles: number;
  modePaiement: ModePaiement;
  typeCommande: TypeCommande;
  montantRecu?: number;
  rendu?: number;
  vendeur?: string;              // vendeur ayant réalisé l'encaissement
  // Retours (avoir) — type 'retour' : montants négatifs, référence au ticket d'origine
  type?: TypeTicket;              // 'vente' (défaut) ou 'retour'
  ticketOrigineId?: string;      // doc id du ticket de vente retourné
  ticketOrigineNumero?: number;  // n° du ticket d'origine (affichage)
  motifRetour?: string;
  sessionId?: string;            // session de caisse rattachée
}

/** Session de caisse (type Odoo) : ouverture avec fond, clôture avec comptage. */
export interface SessionPOS {
  id?: string;
  date: string;                  // yyyy-mm-dd d'ouverture
  ouvertePar: string;            // vendeur
  ouvertureAt: Date;
  fondCaisse: number;            // fond de caisse initial (espèces)
  statut: 'ouverte' | 'fermee';
  // Renseignés à la clôture
  fermetureAt?: Date;
  comptageEspeces?: number;      // espèces réellement comptées
  totalVentes?: number;          // CA net de la session
  totalEspeces?: number;         // net espèces (ventes − retours)
  totalOm?: number;
  totalWave?: number;
  totalRetours?: number;
  nbTickets?: number;
  especesAttendues?: number;     // fond + net espèces
  ecart?: number;                // comptage − attendu
}

// Heure de bascule matin → soir pour la ventilation des ventes caisse
export const HEURE_BASCULE_MATIN_SOIR = 14;

const dateDeTicket = (t: TicketPOS): Date => {
  const v: any = t.createdAt;
  return v && typeof v.toDate === 'function' ? v.toDate() : new Date(v);
};

/** Période (matin/soir) d'un ticket selon son heure. */
export const periodeTicket = (t: TicketPOS): 'matin' | 'soir' =>
  dateDeTicket(t).getHours() < HEURE_BASCULE_MATIN_SOIR ? 'matin' : 'soir';

interface PosStore {
  isSaving: boolean;
  ticketsDuJour: TicketPOS[];
  // Session de caisse
  sessionActive: SessionPOS | null;
  chargerSessionActive: () => Promise<void>;
  ouvrirSession: (params: { ouvertePar: string; fondCaisse: number }) => Promise<void>;
  fermerSession: (comptageEspeces: number) => Promise<SessionPOS | null>;
  /** Résumé (live) de la session active pour l'écran de clôture. */
  getResumeSessionActive: () => Promise<ResumeSession | null>;
  chargerTicketsDuJour: (date: Date) => Promise<void>;
  enregistrerTicket: (ticket: Omit<TicketPOS, 'id' | 'createdAt' | 'numero'>) => Promise<number>;
  /** Supprime un ticket (réservé admin côté UI). */
  supprimerTicket: (id: string) => Promise<void>;
  /** Récupère les tickets POS sur une période (bornes incluses). */
  getTicketsPeriode: (debut: Date, fin: Date) => Promise<TicketPOS[]>;
  /** Somme des totaux des tickets POS sur une période. */
  getVentesPeriode: (debut: Date, fin: Date) => Promise<number>;
  /** Encaissements POS ventilés par moyen de paiement sur une période. */
  getEncaissementsParMode: (debut: Date, fin: Date) => Promise<Record<ModePaiement, number>>;
  /** Retours (avoirs) déjà enregistrés pour un ticket de vente donné. */
  getRetoursDeTicket: (ticketOrigineId: string) => Promise<TicketPOS[]>;
  /** Quantités nettes vendues par produit (ventes − retours) pour un jour. */
  getQuantitesJour: (date: Date) => Promise<Record<string, number>>;
  /** Quantités nettes vendues par produit, ventilées matin/soir, pour un jour. */
  getQuantitesJourParPeriode: (date: Date) => Promise<Record<string, { matin: number; soir: number; total: number }>>;
  /** Classement des produits par quantités vendues sur les N derniers jours (pour trier la caisse). */
  getClassementProduits: (joursEnArriere?: number) => Promise<Record<string, number>>;
  /** Ventes POS par produit (quantité nette + valeur) sur une période. */
  getVentesParProduitPeriode: (debut: Date, fin: Date) => Promise<Record<string, { qty: number; valeur: number }>>;
}

export interface ResumeSession {
  fondCaisse: number;
  totalVentes: number;
  totalEspeces: number;
  totalOm: number;
  totalWave: number;
  totalRetours: number;
  nbTickets: number;
  especesAttendues: number;
}

const jourKey = (d: Date) => d.toISOString().split('T')[0];

export const usePosStore = create<PosStore>((set, get) => ({
  isSaving: false,
  sessionActive: null,

  chargerSessionActive: async () => {
    try {
      const q = query(collection(db, 'pos_sessions'), where('statut', '==', 'ouverte'));
      const snap = await getDocs(q);
      if (snap.empty) { set({ sessionActive: null }); return; }
      // La plus récente si plusieurs
      const sessions = snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...data, ouvertureAt: data.ouvertureAt?.toDate ? data.ouvertureAt.toDate() : new Date(data.ouvertureAt) } as SessionPOS;
      }).sort((a, b) => b.ouvertureAt.getTime() - a.ouvertureAt.getTime());
      set({ sessionActive: sessions[0] });
    } catch (e) {
      console.error('Erreur chargement session POS:', e);
      set({ sessionActive: null });
    }
  },

  ouvrirSession: async ({ ouvertePar, fondCaisse }) => {
    const now = new Date();
    const payload = {
      date: jourKey(now),
      ouvertePar,
      ouvertureAt: Timestamp.now(),
      fondCaisse,
      statut: 'ouverte' as const,
    };
    const ref = await addDoc(collection(db, 'pos_sessions'), payload);
    set({ sessionActive: { id: ref.id, ...payload, ouvertureAt: now } });
  },

  getResumeSessionActive: async () => {
    const session = get().sessionActive;
    if (!session?.id) return null;
    let tickets: TicketPOS[] = [];
    try {
      const q = query(collection(db, 'pos_tickets'), where('sessionId', '==', session.id));
      const snap = await getDocs(q);
      tickets = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TicketPOS[];
    } catch (e) {
      console.error('Erreur résumé session:', e);
    }
    const somme = (m: ModePaiement) => tickets.filter(t => t.modePaiement === m).reduce((s, t) => s + (t.total || 0), 0);
    const totalEspeces = somme('espece');
    const totalOm = somme('om');
    const totalWave = somme('wave');
    return {
      fondCaisse: session.fondCaisse || 0,
      totalEspeces, totalOm, totalWave,
      totalVentes: totalEspeces + totalOm + totalWave,
      totalRetours: tickets.filter(t => t.type === 'retour').reduce((s, t) => s + Math.abs(t.total || 0), 0),
      nbTickets: tickets.length,
      especesAttendues: (session.fondCaisse || 0) + totalEspeces,
    };
  },

  fermerSession: async (comptageEspeces: number) => {
    const session = get().sessionActive;
    if (!session?.id) return null;
    // Tickets de la session
    let tickets: TicketPOS[] = [];
    try {
      const q = query(collection(db, 'pos_tickets'), where('sessionId', '==', session.id));
      const snap = await getDocs(q);
      tickets = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TicketPOS[];
    } catch (e) {
      console.error('Erreur chargement tickets session:', e);
    }
    const somme = (m: ModePaiement) => tickets.filter(t => t.modePaiement === m).reduce((s, t) => s + (t.total || 0), 0);
    const totalEspeces = somme('espece');
    const totalOm = somme('om');
    const totalWave = somme('wave');
    const totalVentes = totalEspeces + totalOm + totalWave;
    const totalRetours = tickets.filter(t => t.type === 'retour').reduce((s, t) => s + Math.abs(t.total || 0), 0);
    const especesAttendues = (session.fondCaisse || 0) + totalEspeces;
    const ecart = Math.round((comptageEspeces - especesAttendues + Number.EPSILON) * 100) / 100;

    const cloture: Partial<SessionPOS> = {
      statut: 'fermee',
      fermetureAt: new Date(),
      comptageEspeces,
      totalVentes,
      totalEspeces,
      totalOm,
      totalWave,
      totalRetours,
      nbTickets: tickets.length,
      especesAttendues,
      ecart,
    };
    try {
      await updateDoc(doc(db, 'pos_sessions', session.id), { ...cloture, fermetureAt: Timestamp.now() });
    } catch (e) {
      console.error('Erreur clôture session:', e);
      throw e;
    }
    const sessionFermee = { ...session, ...cloture } as SessionPOS;
    set({ sessionActive: null });
    return sessionFermee;
  },

  ticketsDuJour: [],

  chargerTicketsDuJour: async (date: Date) => {
    try {
      const q = query(
        collection(db, 'pos_tickets'),
        where('date', '==', jourKey(date)),
        orderBy('numero', 'asc')
      );
      const snap = await getDocs(q);
      set({ ticketsDuJour: snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TicketPOS[] });
    } catch (e) {
      // orderBy peut nécessiter un index ; on retombe sur un chargement simple
      try {
        const q2 = query(collection(db, 'pos_tickets'), where('date', '==', jourKey(date)));
        const snap = await getDocs(q2);
        set({ ticketsDuJour: snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TicketPOS[] });
      } catch (err) {
        console.error('Erreur chargement tickets POS:', err);
      }
    }
  },

  getTicketsPeriode: async (debut: Date, fin: Date) => {
    const debutKey = jourKey(debut);
    const finKey = jourKey(fin);
    try {
      const q = query(
        collection(db, 'pos_tickets'),
        where('date', '>=', debutKey),
        where('date', '<=', finKey)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TicketPOS[];
    } catch (e) {
      // Repli : on charge tout et on filtre côté client
      try {
        const snap = await getDocs(collection(db, 'pos_tickets'));
        return (snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TicketPOS[])
          .filter(t => t.date >= debutKey && t.date <= finKey);
      } catch (err) {
        console.error('Erreur chargement tickets POS période:', err);
        return [];
      }
    }
  },

  getVentesPeriode: async (debut: Date, fin: Date) => {
    const tickets = await get().getTicketsPeriode(debut, fin);
    return tickets.reduce((s, t) => s + (t.total || 0), 0);
  },

  getEncaissementsParMode: async (debut: Date, fin: Date) => {
    const tickets = await get().getTicketsPeriode(debut, fin);
    const acc: Record<ModePaiement, number> = { espece: 0, om: 0, wave: 0 };
    tickets.forEach(t => { acc[t.modePaiement] = (acc[t.modePaiement] || 0) + (t.total || 0); });
    return acc;
  },

  getQuantitesJour: async (date: Date) => {
    const tickets = await get().getTicketsPeriode(date, date);
    const map: Record<string, number> = {};
    tickets.forEach(t => t.lignes.forEach(l => {
      map[l.produitId] = (map[l.produitId] || 0) + l.quantite; // retours = quantités négatives → net
    }));
    return map;
  },

  getQuantitesJourParPeriode: async (date: Date) => {
    const tickets = await get().getTicketsPeriode(date, date);
    const map: Record<string, { matin: number; soir: number; total: number }> = {};
    tickets.forEach(t => {
      const periode = periodeTicket(t);
      t.lignes.forEach(l => {
        if (!map[l.produitId]) map[l.produitId] = { matin: 0, soir: 0, total: 0 };
        map[l.produitId][periode] += l.quantite;
        map[l.produitId].total += l.quantite;
      });
    });
    return map;
  },

  getClassementProduits: async (joursEnArriere = 30) => {
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - joursEnArriere);
    const tickets = await get().getTicketsPeriode(debut, fin);
    const map: Record<string, number> = {};
    tickets.forEach(t => t.lignes.forEach(l => {
      map[l.produitId] = (map[l.produitId] || 0) + l.quantite; // net (retours en négatif)
    }));
    return map;
  },

  getVentesParProduitPeriode: async (debut: Date, fin: Date) => {
    const tickets = await get().getTicketsPeriode(debut, fin);
    const map: Record<string, { qty: number; valeur: number }> = {};
    tickets.forEach(t => t.lignes.forEach(l => {
      if (!map[l.produitId]) map[l.produitId] = { qty: 0, valeur: 0 };
      map[l.produitId].qty += l.quantite;                       // net (retours négatifs)
      map[l.produitId].valeur += l.quantite * (l.prixUnitaire || 0);
    }));
    return map;
  },

  getRetoursDeTicket: async (ticketOrigineId: string) => {
    try {
      const q = query(collection(db, 'pos_tickets'), where('ticketOrigineId', '==', ticketOrigineId));
      const snap = await getDocs(q);
      return (snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TicketPOS[])
        .filter(t => t.type === 'retour');
    } catch (err) {
      console.error('Erreur chargement retours du ticket:', err);
      return [];
    }
  },

  enregistrerTicket: async (ticket) => {
    set({ isSaving: true });
    try {
      const date = new Date();
      // Numéro de ticket = nombre de tickets du jour + 1
      // Lecture d'agrégation (1 lecture) au lieu de charger tous les tickets du jour
      let numero = 1;
      try {
        const qCount = query(collection(db, 'pos_tickets'), where('date', '==', jourKey(date)));
        const countSnap = await getCountFromServer(qCount);
        numero = (countSnap.data().count || 0) + 1;
      } catch {
        await get().chargerTicketsDuJour(date);
        numero = (get().ticketsDuJour.length || 0) + 1;
      }

      const sessionId = get().sessionActive?.id;
      const ref = await addDoc(collection(db, 'pos_tickets'), {
        ...ticket,
        numero,
        createdAt: Timestamp.now(),
        ...(sessionId ? { sessionId } : {}),
      });
      set(state => ({
        isSaving: false,
        ticketsDuJour: [...state.ticketsDuJour, { id: ref.id, numero, createdAt: date, ...ticket, ...(sessionId ? { sessionId } : {}) }],
      }));
      return numero;
    } catch (e) {
      set({ isSaving: false });
      console.error('Erreur enregistrement ticket POS:', e);
      throw e;
    }
  },

  supprimerTicket: async (id: string) => {
    await deleteDoc(doc(db, 'pos_tickets', id));
    set(state => ({ ticketsDuJour: state.ticketsDuJour.filter(t => t.id !== id) }));
  },
}));
