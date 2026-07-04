import { create } from 'zustand';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
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
  // Retours (avoir) — type 'retour' : montants négatifs, référence au ticket d'origine
  type?: TypeTicket;              // 'vente' (défaut) ou 'retour'
  ticketOrigineId?: string;      // doc id du ticket de vente retourné
  ticketOrigineNumero?: number;  // n° du ticket d'origine (affichage)
  motifRetour?: string;
}

interface PosStore {
  isSaving: boolean;
  ticketsDuJour: TicketPOS[];
  chargerTicketsDuJour: (date: Date) => Promise<void>;
  enregistrerTicket: (ticket: Omit<TicketPOS, 'id' | 'createdAt' | 'numero'>) => Promise<number>;
  /** Récupère les tickets POS sur une période (bornes incluses). */
  getTicketsPeriode: (debut: Date, fin: Date) => Promise<TicketPOS[]>;
  /** Somme des totaux des tickets POS sur une période. */
  getVentesPeriode: (debut: Date, fin: Date) => Promise<number>;
  /** Retours (avoirs) déjà enregistrés pour un ticket de vente donné. */
  getRetoursDeTicket: (ticketOrigineId: string) => Promise<TicketPOS[]>;
}

const jourKey = (d: Date) => d.toISOString().split('T')[0];

export const usePosStore = create<PosStore>((set, get) => ({
  isSaving: false,
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
      await get().chargerTicketsDuJour(date);
      const numero = (get().ticketsDuJour.length || 0) + 1;

      const ref = await addDoc(collection(db, 'pos_tickets'), {
        ...ticket,
        numero,
        createdAt: Timestamp.now(),
      });
      set(state => ({
        isSaving: false,
        ticketsDuJour: [...state.ticketsDuJour, { id: ref.id, numero, createdAt: date, ...ticket }],
      }));
      return numero;
    } catch (e) {
      set({ isSaving: false });
      console.error('Erreur enregistrement ticket POS:', e);
      throw e;
    }
  },
}));
