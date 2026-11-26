import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { collection, updateDoc, doc, setDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { realTimeListeners } from '../firebase/collections';
import { db } from '../firebase/config';
import type { Facture, LigneFacture, ParametresFacturation, CommandeClient, InvendusClient, Client, Reglement, ModePaiement } from '../types';
import { addToSyncQueue, flushSyncQueue } from '../utils/syncQueue';
import { useReferentielStore } from './referentielStore';
import { useLivraisonStore } from './livraisonStore';
import { extraireDateCalendaire } from './productionStore';


interface FacturationStore {
  // État
  factures: Facture[];
  factureActive: Facture | null;
  parametres: ParametresFacturation | null;
  isLoading: boolean;

  // Listener unsubscribe functions
  facturesListener: (() => void) | null;

  // Actions Factures
  genererFacturesDepuisLivraisons: (date: Date, commandesClients: CommandeClient[], retoursClients: InvendusClient[]) => Promise<void>;
  genererFacturesPourClient: (clientId: string, dateReference?: Date) => Promise<void>;
  mettreAJourFactureApresRetours: (clientId: string, date: Date, produitsRetours: Array<{ produitId: string; invendus: number }>, retoursCompletes?: boolean) => Promise<void>;
  chargerFactures: (dateDebut?: Date, dateFin?: Date, background?: boolean) => Promise<void>;
  chargerFacturesAvecListener: (dateDebut?: Date, dateFin?: Date) => void;
  chargerFacture: (factureId: string) => Promise<void>;
  validerFacture: (factureId: string) => Promise<void>;
  envoyerFacture: (factureId: string) => Promise<void>;
  marquerPayee: (factureId: string, reglements: Reglement[] | { montant: number, mode: ModePaiement, date?: Date }) => Promise<void>;
  /** Journal des règlements sur une période (par date de règlement, cross-période). */
  getReglementsPeriode: (debut: Date, fin: Date) => Promise<{ mode: ModePaiement; montant: number; date: Date; factureId: string; clientId: string }[]>;
  /** Obtenir tous les versements (règlements) d'un client donné sur une période. */
  getReglementsClientPeriode: (clientId: string, debut: Date, fin: Date) => Promise<{ id: string; mode: ModePaiement; montant: number; date: Date; factureId: string; clientId: string; reference?: string }[]>;
  /** Obtenir toutes les factures d'un client. */
  getFacturesClient: (clientId: string) => Promise<Facture[]>;
  /** Ventes livraison (factures) par produit sur une période, par date de livraison. */
  getVentesFactureParProduit: (debut: Date, fin: Date, payeesUniquement?: boolean) => Promise<Record<string, { qty: number; valeur: number }>>;
  /** Ventes livraison détaillées ligne par ligne avec date et client. */
  getVentesFactureDetaillees: (debut: Date, fin: Date, payeesUniquement?: boolean) => Promise<Array<{
    date: string;
    clientId: string;
    clientNom: string;
    numeroFacture: string;
    produitId: string;
    nomProduit?: string;
    quantite: number;
    prixUnitaire: number;
    montant: number;
    statut: string;
  }>>;
  /** Date (yyyy-mm-dd) de la toute première livraison facturée, ou null. */
  getPremiereDateVenteLivraison: () => Promise<string | null>;
  /** Alimente le journal 'reglements' à partir des règlements existants sur les factures (idempotent). */
  backfillReglementsJournal: () => Promise<number>;
  annulerFacture: (factureId: string, motif?: string) => Promise<void>;
  actualiserStatutsFactures: (clientId?: string, date?: Date) => Promise<void>;
  modifierTauxTVA: (factureId: string, nouveauTaux: number) => Promise<void>;
  supprimerFacture: (factureId: string) => Promise<void>;
  ajouterAvoirClient: (clientId: string, montant: number) => Promise<void>;

  // Actions Paramètres
  chargerParametres: () => Promise<void>;
  sauvegarderParametres: (parametres: Partial<ParametresFacturation>) => Promise<void>;

  // Actions utilitaires
  calculerTotauxFacture: (lignes: LigneFacture[], tauxTVA: number) => { totalHT: number; montantTVA: number; totalTTC: number };
  genererNumeroFacture: (date: Date) => string;
  verifierRetoursCompletes: (clientId: string, date: Date, retoursClients: InvendusClient[]) => boolean;
  nettoyerListeners: () => void;

  // Setters
  setLoading: (loading: boolean) => void;
  setFactureActive: (facture: Facture | null) => void;
}

export const useFacturationStore = create<FacturationStore>()(
  persist(
    (set, get) => ({
      // État initial
      factures: [],
      factureActive: null,
      parametres: null,
      isLoading: false,

      // Listeners
      facturesListener: null,

      // Actions Factures
      genererFacturesDepuisLivraisons: async (date: Date, commandesClients: CommandeClient[], retoursClients: InvendusClient[]) => {
        set({ isLoading: true });

        try {
          let parametres = get().parametres;
          if (!parametres) {
            try {
              await get().chargerParametres();
              parametres = get().parametres;
            } catch (_) {}
          }
          const paramsSafe: ParametresFacturation = parametres || {
            id: 'parametres_defaut',
            tauxTVADefaut: 0,
            conditionsPaiementDefaut: 'Paiement à réception',
            mentionsLegales: '',
            numeroFactureProchain: 1,
            prefixeFacture: 'FACT'
          };

          if (!commandesClients || commandesClients.length === 0) {
            set({ isLoading: false });
            return;
          }

          const targetDateStr = extraireDateCalendaire(date) || (date instanceof Date ? date.toISOString().split('T')[0] : String(date));

          // Bornes pour la query
          const debutJour = new Date(targetDateStr + 'T00:00:00.000Z');
          const finJour = new Date(targetDateStr + 'T23:59:59.999Z');

          const qFactures = query(
            collection(db, 'factures'),
            where('dateLivraison', '>=', debutJour),
            where('dateLivraison', '<=', finJour),
            limit(100)
          );

          let facturesExistantes: Facture[] = [];
          try {
            const snapFactures = await getDocs(qFactures);
            facturesExistantes = snapFactures.docs.map(doc => {
              const data = doc.data();
              return {
                ...data,
                id: doc.id,
                dateLivraison: data.dateLivraison?.toDate ? data.dateLivraison.toDate() : new Date(data.dateLivraison)
              } as Facture;
            });
          } catch (e) {
            console.warn('Lecture factures existantes Firestore ignorée (repli local):', e);
            facturesExistantes = (get().factures || []).filter(f => {
              return extraireDateCalendaire(f.dateLivraison) === targetDateStr;
            });
          }

          // Grouper les commandes par client (en ignorant les annulées)
          const commandesParClient = new Map<string, CommandeClient[]>();
          commandesClients.filter(c => c.statut !== 'annulee').forEach(commande => {
            const clientId = commande.clientId;
            if (!commandesParClient.has(clientId)) {
              commandesParClient.set(clientId, []);
            }
            commandesParClient.get(clientId)!.push(commande);
          });

          // Utiliser les référentiels en mémoire ou charger si vides
          let refClients = useReferentielStore.getState().clients || [];
          let refProduits = useReferentielStore.getState().produits || [];

          if (refClients.length === 0) {
            try {
              const { useProductionStore } = await import('./productionStore');
              refClients = useProductionStore.getState().clients || [];
            } catch (_) {}
          }
          if (refProduits.length === 0) {
            try {
              const { useProductionStore } = await import('./productionStore');
              refProduits = useProductionStore.getState().produits || [];
            } catch (_) {}
          }

          const clientsCache = new Map<string, Client>(refClients.map(c => [c.id, c]));
          const produitsCache = new Map<string, any>(refProduits.map(p => [p.id, {
            ...p,
            prixClient: p.prixClient || 0,
            prixBoutique: p.prixBoutique || 0,
            prixUnitaire: p.prixUnitaire || 0
          }]));

          const nouvelles: Facture[] = [];
          const misesAJour: Facture[] = [];

          // Traiter chaque client ayant une commande
          for (const [clientId, commandesClient] of commandesParClient) {
            const deterministicId = `facture_${clientId}_${targetDateStr}`;

            // Vérifier si une facture existe déjà pour ce client
            let factureExistante = facturesExistantes.find(f =>
              f.id === deterministicId ||
              (f.clientId === clientId && extraireDateCalendaire(f.dateLivraison) === targetDateStr)
            );

            if (!factureExistante) {
              try {
                const docSnap = await getDoc(doc(db, 'factures', deterministicId));
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  factureExistante = {
                    ...data,
                    id: docSnap.id,
                    dateLivraison: data.dateLivraison?.toDate ? data.dateLivraison.toDate() : new Date(data.dateLivraison)
                  } as Facture;
                }
              } catch (_) {}
            }

            // Ne sauter QUE si la facture est payée ou annulée ET a déjà un montant valide (> 0)
            if (factureExistante && ['payee', 'annulee'].includes(factureExistante.statut) && (factureExistante.totalTTC || 0) > 0) {
              continue;
            }

            // Récupérer les informations du client depuis le cache ou la commande
            const cmdClientFallback = commandesClient[0]?.client;
            let clientInfo = clientsCache.get(clientId) || cmdClientFallback;
            if (!clientInfo) {
              const fromRef = refClients.find(c => c.id === clientId);
              if (fromRef) clientInfo = fromRef;
            }

            const clientNomFallback = clientInfo?.nom || (commandesClient[0] as any)?.clientNom || (commandesClient[0] as any)?.client?.nom || `Client ${clientId}`;

            // Récupérer les retours de ce client pour cette date
            let retoursClient = (retoursClients || []).find(r =>
              r.clientId === clientId &&
              extraireDateCalendaire(r.dateLivraison) === targetDateStr
            );

            if (!retoursClient) {
              const invendusStore = useLivraisonStore.getState().invendusClients || [];
              retoursClient = invendusStore.find(r =>
                r.clientId === clientId &&
                extraireDateCalendaire(r.dateLivraison) === targetDateStr
              );
            }

            if (!retoursClient) {
              try {
                const docSnap = await getDoc(doc(db, 'clientReturns', `retours_${clientId}_${targetDateStr}`));
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  retoursClient = {
                    ...data,
                    id: docSnap.id,
                    dateLivraison: data.dateLivraison?.toDate ? data.dateLivraison.toDate() : new Date(data.dateLivraison)
                  } as InvendusClient;
                }
              } catch (_) {}
            }

            const retoursCompletes = retoursClient?.retoursCompletes === true || get().verifierRetoursCompletes(clientId, date, retoursClients || []);

            // Calculer les lignes de facture avec agrégation par produit
            const lignesMap = new Map<string, LigneFacture>();

            for (const commande of commandesClient) {
              for (const produitCmd of commande.produits) {
                // Récupérer les informations complètes du produit depuis le cache ou la commande
                const cachedProd = produitsCache.get(produitCmd.produitId);
                const cmdProdFallback = (produitCmd as any).produit;
                const produitFull: any = cachedProd || cmdProdFallback || {
                  id: produitCmd.produitId,
                  nom: (produitCmd as any).nomProduit || (produitCmd as any).nom || 'Produit',
                  prixUnitaire: Number(produitCmd.prixUnitaire) || 0,
                  prixClient: Number(produitCmd.prixUnitaire) || 0,
                  prixBoutique: Number(produitCmd.prixUnitaire) || 0
                };

                // Si le nom était resté 'Produit Inconnu', chercher un meilleur nom
                if (!produitFull.nom || produitFull.nom === 'Produit Inconnu') {
                  const betterName = (produitCmd as any).nomProduit || (produitCmd as any).produit?.nom || refProduits.find(p => p.id === produitCmd.produitId)?.nom;
                  if (betterName) produitFull.nom = betterName;
                }

                // Quantité totale livrée pour cette commande spécifique
                let quantiteLivree = Object.values(produitCmd.repartitionCars || {})
                  .reduce((sum, qte) => sum + (Number(qte) || 0), 0);
                if (quantiteLivree === 0 && Number(produitCmd.quantiteCommandee) > 0) {
                  quantiteLivree = Number(produitCmd.quantiteCommandee);
                }

                if (quantiteLivree > 0) {
                  // Prix unitaire : priorité au prix de la commande
                  let prixUnitaire = Number(produitCmd.prixUnitaire) || 0;
                  if (!prixUnitaire || prixUnitaire <= 0) {
                    const isClient = (clientInfo?.typeClient === 'client' || (commande as any).client?.typeClient === 'client');
                    prixUnitaire = isClient
                      ? (Number(produitFull.prixClient) || Number(produitFull.prixUnitaire) || 0)
                      : (Number(produitFull.prixBoutique) || Number(produitFull.prixUnitaire) || 0);
                  }
                  if (!prixUnitaire || prixUnitaire <= 0) {
                    const refP = refProduits.find(p => p.id === produitCmd.produitId);
                    if (refP) {
                      prixUnitaire = Number(refP.prixClient) || Number(refP.prixUnitaire) || 0;
                    }
                  }

                  if (lignesMap.has(produitCmd.produitId)) {
                    // Mise à jour de la ligne existante
                    const ligneExistante = lignesMap.get(produitCmd.produitId)!;
                    ligneExistante.quantiteLivree += quantiteLivree;
                    if (prixUnitaire > 0 && ligneExistante.prixUnitaire === 0) {
                      ligneExistante.prixUnitaire = prixUnitaire;
                    }
                  } else {
                    lignesMap.set(produitCmd.produitId, {
                      produitId: produitCmd.produitId,
                      produit: {
                        ...produitFull,
                        prixUnitaire: prixUnitaire,
                        prixClient: produitFull.prixClient || prixUnitaire
                      },
                      quantiteLivree,
                      quantiteRetournee: 0,
                      quantiteFacturee: 0,
                      prixUnitaire,
                      montantLigne: 0
                    });
                  }
                }
              }
            }

            // Déduire systématiquement les retours de chaque ligne
            for (const ligne of lignesMap.values()) {
              const produitRetour = retoursClient?.produits?.find(p => p.produitId === ligne.produitId);
              const qteRetour = Number(produitRetour?.invendus) || 0;
              ligne.quantiteRetournee = qteRetour;
              ligne.quantiteFacturee = Math.max(0, ligne.quantiteLivree - qteRetour);
              ligne.montantLigne = ligne.quantiteFacturee * (ligne.prixUnitaire || 0);
            }

            const lignes = Array.from(lignesMap.values());

            if (lignes.length > 0) {
              // Calculer les totaux
              const totaux = get().calculerTotauxFacture(lignes, paramsSafe.tauxTVADefaut);

              // Calculer l'utilisation du solde / avoir
              let soldeUtilise = 0;
              let netAPayer = totaux.totalTTC;

              let soldeDisponible = clientInfo?.solde || 0;
              if (factureExistante && factureExistante.soldeUtilise) {
                soldeDisponible += factureExistante.soldeUtilise;
              }

              if (soldeDisponible > 0) {
                soldeUtilise = Math.min(soldeDisponible, totaux.totalTTC);
                netAPayer = Math.max(0, totaux.totalTTC - soldeUtilise);
              }

              // Préparer l'objet facture pour Firestore (nettoyage)
              const lignesClean = lignes.map(ligne => {
                const p = ligne.produit as any;
                return {
                  produitId: ligne.produitId,
                  quantiteLivree: ligne.quantiteLivree,
                  quantiteRetournee: ligne.quantiteRetournee,
                  quantiteFacturee: ligne.quantiteFacturee,
                  prixUnitaire: ligne.prixUnitaire,
                  montantLigne: ligne.montantLigne,
                  produit: p ? {
                    id: p.id || ligne.produitId,
                    nom: p.nom || 'Produit',
                    prixUnitaire: p.prixUnitaire || ligne.prixUnitaire,
                    prixClient: p.prixClient || ligne.prixUnitaire,
                    prixBoutique: p.prixBoutique || ligne.prixUnitaire
                  } : null
                };
              });

              const clientClean = {
                id: clientId,
                nom: clientNomFallback,
                prenom: (clientInfo as any)?.prenom || '',
                adresse: clientInfo?.adresse || '',
                telephone: clientInfo?.telephone || '',
                email: clientInfo?.email || '',
                typeClient: clientInfo?.typeClient || 'client',
              };

              if (factureExistante) {
                // MISE À JOUR FACTURE EXISTANTE
                const updates = {
                  client: clientClean,
                  lignes: lignesClean,
                  ...totaux,
                  soldeUtilise,
                  netAPayer,
                  statut: retoursCompletes ? 'validee' : 'en_attente_retours',
                  retoursCompletes,
                  updatedAt: new Date()
                } as any;

                if (retoursCompletes && factureExistante.statut !== 'validee') {
                  updates.validatedAt = new Date();
                }

                try {
                  await Promise.race([
                    updateDoc(doc(db, 'factures', factureExistante.id), updates),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
                  ]);
                } catch (e) {
                  console.warn('Mise à jour facture Firestore ignorée (quota ou réseau):', e);
                }

                misesAJour.push({
                  ...factureExistante,
                  client: clientClean as any,
                  lignes,
                  ...totaux,
                  statut: updates.statut,
                  retoursCompletes,
                  updatedAt: updates.updatedAt,
                  validatedAt: updates.validatedAt || factureExistante.validatedAt
                });

              } else {
                // CRÉATION NOUVELLE FACTURE
                const nouvelleFacture: Facture = {
                  id: deterministicId,
                  numeroFacture: get().genererNumeroFacture(date),
                  clientId,
                  client: clientClean as any,
                  dateLivraison: date,
                  dateFacture: new Date(),
                  lignes,
                  ...totaux,
                  soldeUtilise,
                  netAPayer,
                  tauxTVA: paramsSafe.tauxTVADefaut,
                  statut: retoursCompletes ? 'validee' : 'en_attente_retours',
                  retoursCompletes,
                  conditionsPaiement: clientInfo?.conditionsPaiement || paramsSafe.conditionsPaiementDefaut,
                  createdAt: new Date(),
                  updatedAt: new Date()
                };

                const factureFirebase = {
                  ...nouvelleFacture,
                  lignes: lignesClean,
                  client: clientClean
                };

                try {
                  await Promise.race([
                    setDoc(doc(db, 'factures', nouvelleFacture.id), factureFirebase, { merge: true }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
                  ]);
                } catch (e) {
                  console.warn('Création facture Firestore ignorée (quota ou réseau):', e);
                }
                nouvelles.push(nouvelleFacture);
              }
            }
          }

          set(state => {
            const facturesMisesAJour = state.factures.map(f => {
              const updated = misesAJour.find(u => u.id === f.id);
              return updated || f;
            });

            // Ajouter les nouvelles et dédupliquer par ID
            const toutesLesFactures = [...facturesMisesAJour, ...nouvelles];
            const facturesUniques = Array.from(new Map(toutesLesFactures.map(f => [f.id, f])).values());

            return {
              factures: facturesUniques,
              isLoading: false
            };
          });

        } catch (error) {
          set({ isLoading: false });
          console.error('❌ Erreur lors de la génération/mise à jour des factures:', error);
          throw error;
        }
      },

      mettreAJourFactureApresRetours: async (
        clientId: string,
        date: Date,
        produitsRetours: Array<{ produitId: string; invendus: number }>,
        retoursCompletes: boolean = true
      ) => {
        const dateKey = extraireDateCalendaire(date) || (date instanceof Date ? date.toISOString().split('T')[0] : String(date));
        const deterministicId = `facture_${clientId}_${dateKey}`;

        // 1. Chercher la facture existante dans le store ou Firestore
        let facture: Facture | undefined = get().factures.find(f =>
          f.id === deterministicId ||
          (f.clientId === clientId && extraireDateCalendaire(f.dateLivraison) === dateKey)
        );

        if (!facture) {
          try {
            const snap = await getDoc(doc(db, 'factures', deterministicId));
            if (snap.exists()) {
              const d = snap.data();
              facture = {
                ...d,
                id: snap.id,
                dateLivraison: d.dateLivraison?.toDate ? d.dateLivraison.toDate() : new Date(d.dateLivraison),
                dateFacture: d.dateFacture?.toDate ? d.dateFacture.toDate() : new Date(d.dateFacture),
                createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt),
                updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate() : new Date(d.updatedAt),
              } as Facture;
            }
          } catch (e) {
            console.warn('Erreur lecture facture pour retours:', e);
          }
        }

        // Si aucune facture trouvée, tenter genererFacturesDepuisLivraisons
        if (!facture) {
          try {
            const { useProductionStore } = await import('./productionStore');
            const { commandesClients } = useProductionStore.getState();
            const invendusUpdated = useLivraisonStore.getState().invendusClients;
            await get().genererFacturesDepuisLivraisons(date, commandesClients, invendusUpdated);
          } catch (e) {
            console.warn('Génération facture de repli échouée:', e);
          }
          return;
        }

        // Ne pas écraser si payée ou annulée avec montant
        if (['payee', 'annulee'].includes(facture.statut) && (facture.totalTTC || 0) > 0) {
          return;
        }

        // 2. Mettre à jour les lignes avec les quantités retournées
        const retoursMap = new Map<string, number>(
          (produitsRetours || []).map(p => [p.produitId, Number(p.invendus) || 0])
        );

          const nouvellesLignes: LigneFacture[] = (facture.lignes || []).map(ligne => {
            const qteRetour = retoursMap.has(ligne.produitId) ? retoursMap.get(ligne.produitId)! : 0;
            const qteLivree = Number(ligne.quantiteLivree) || 0;
            const qteFacturee = Math.max(0, qteLivree - qteRetour);
            const pu = Number(ligne.prixUnitaire) || 0;
            return {
              ...ligne,
              quantiteLivree: qteLivree,
              quantiteRetournee: qteRetour,
              quantiteFacturee: qteFacturee,
              montantLigne: qteFacturee * pu
            };
          });

        // 3. Recalculer les totaux
        let parametres = get().parametres;
        if (!parametres) {
          try { await get().chargerParametres(); parametres = get().parametres; } catch (_) {}
        }
        const tauxTVA = facture.tauxTVA ?? (parametres?.tauxTVADefaut || 0);
        const totaux = get().calculerTotauxFacture(nouvellesLignes, tauxTVA);

        const soldeUtilise = facture.soldeUtilise || 0;
        const netAPayer = Math.max(0, totaux.totalTTC - soldeUtilise);
        const nouveauStatut = retoursCompletes ? 'validee' : 'en_attente_retours';

        // 4. Nettoyage pour Firestore
        const lignesClean = nouvellesLignes.map(l => {
          const p = l.produit as any;
          return {
            produitId: l.produitId,
            quantiteLivree: l.quantiteLivree,
            quantiteRetournee: l.quantiteRetournee,
            quantiteFacturee: l.quantiteFacturee,
            prixUnitaire: l.prixUnitaire,
            montantLigne: l.montantLigne,
            produit: p ? {
              id: p.id || l.produitId,
              nom: p.nom || 'Produit',
              prixUnitaire: p.prixUnitaire || l.prixUnitaire,
              prixClient: p.prixClient || l.prixUnitaire,
              prixBoutique: p.prixBoutique || l.prixUnitaire
            } : null
          };
        });

        const updates: any = {
          lignes: lignesClean,
          ...totaux,
          netAPayer,
          statut: nouveauStatut,
          retoursCompletes,
          updatedAt: new Date()
        };

        if (retoursCompletes && facture.statut !== 'validee') {
          updates.validatedAt = new Date();
        }

        // 5. Sauvegarder dans Firestore
        try {
          await updateDoc(doc(db, 'factures', facture.id), updates);
        } catch (err) {
          console.warn('Erreur Firestore mise à jour facture retours:', err);
        }

        // 6. Mettre à jour dans le state local Zustand
        const factureUpdated: Facture = {
          ...facture,
          lignes: nouvellesLignes,
          ...totaux,
          netAPayer,
          statut: nouveauStatut,
          retoursCompletes,
          updatedAt: updates.updatedAt,
          validatedAt: updates.validatedAt || facture.validatedAt
        };

        set(state => ({
          factures: state.factures.some(f => f.id === facture!.id)
            ? state.factures.map(f => f.id === facture!.id ? factureUpdated : f)
            : [...state.factures, factureUpdated]
        }));
      },

      genererFacturesPourClient: async (clientId: string, dateReference?: Date) => {
        set({ isLoading: true });
        try {
          const { parametres } = get();
          if (!parametres) {
            // Tenter de charger les paramètres si manquants
            await get().chargerParametres();
            if (!get().parametres) throw new Error('Impossible de charger les paramètres de facturation');
          }
          const params = get().parametres!;

          let dateDebut: Date;
          let dateFin: Date | null = null; // null means no upper limit if defaulting to "recent"

          if (dateReference) {
            // 1er du mois
            dateDebut = new Date(dateReference.getFullYear(), dateReference.getMonth(), 1);
            dateDebut.setHours(0, 0, 0, 0);

            // Dernier jour du mois
            dateFin = new Date(dateReference.getFullYear(), dateReference.getMonth() + 1, 0);
            dateFin.setHours(23, 59, 59, 999);
          } else {
            // Default: 60 days ago
            dateDebut = new Date();
            dateDebut.setDate(dateDebut.getDate() - 60);
          }

          // 1. Récupérer les commandes du client
          let commandesSnap;
          try {
            commandesSnap = await getDocs(query(
              collection(db, 'clientOrders'),
              where('clientId', '==', clientId)
            ));
          } catch (e) {
            console.warn('Erreur lecture commandes client Firestore:', e);
          }

          const rawCommandes = (commandesSnap?.docs || []).map(d => ({
            ...d.data(),
            id: d.id,
            dateLivraison: d.data().dateLivraison?.toDate ? d.data().dateLivraison.toDate() : new Date(d.data().dateLivraison)
          })) as CommandeClient[];

          // Filtrer par période et exclure annulées
          let commandesValides = rawCommandes.filter(c => {
            if (c.statut === 'annulee') return false;
            const d = new Date(c.dateLivraison);
            return d >= dateDebut && (!dateFin || d <= dateFin);
          });

          if (commandesValides.length === 0) {
            // Repli : vérifier si des commandes existent dans le programme de production en mémoire
            try {
              const { useProductionStore } = await import('./productionStore');
              const progCmds = useProductionStore.getState().commandesClients || [];
              const fromProg = progCmds.filter(c => {
                if (c.clientId !== clientId || c.statut === 'annulee') return false;
                const d = new Date(c.dateLivraison);
                return d >= dateDebut && (!dateFin || d <= dateFin);
              });
              if (fromProg.length > 0) {
                commandesValides = fromProg;
              }
            } catch (_) {}
          }

          if (commandesValides.length === 0) {
            console.log("Aucune commande valide trouvée pour cette période");
            set({ isLoading: false });
            return;
          }

          // 2. Récupérer les retours (invendus) sans requêtes composites
          let retoursSnap;
          try {
            retoursSnap = await getDocs(query(
              collection(db, 'clientReturns'),
              where('clientId', '==', clientId)
            ));
          } catch (e) {
            console.warn('Erreur lecture retours client Firestore:', e);
          }

          const rawRetours = (retoursSnap?.docs || []).map(d => ({
            ...d.data(),
            id: d.id,
            dateLivraison: d.data().dateLivraison?.toDate ? d.data().dateLivraison.toDate() : new Date(d.data().dateLivraison)
          })) as InvendusClient[];

          const retours = rawRetours.filter(r => {
            const d = new Date(r.dateLivraison);
            return d >= dateDebut && (!dateFin || d <= dateFin);
          });

          // 3. Récupérer les factures existantes sans requêtes composites
          let facturesSnap;
          try {
            facturesSnap = await getDocs(query(
              collection(db, 'factures'),
              where('clientId', '==', clientId)
            ));
          } catch (e) {
            console.warn('Erreur lecture factures client Firestore:', e);
          }

          const rawFactures = (facturesSnap?.docs || []).map(d => ({
            ...d.data(),
            id: d.id,
            dateLivraison: d.data().dateLivraison?.toDate ? d.data().dateLivraison.toDate() : new Date(d.data().dateLivraison)
          })) as Facture[];

          const facturesExistantes = rawFactures.filter(f => {
            const d = new Date(f.dateLivraison);
            return d >= dateDebut && (!dateFin || d <= dateFin);
          });

          // 4. Grouper par date
          const commandesParDate = new Map<string, CommandeClient[]>();
          commandesValides.forEach(c => {
            const dateStr = c.dateLivraison.toISOString().split('T')[0];
            if (!commandesParDate.has(dateStr)) commandesParDate.set(dateStr, []);
            commandesParDate.get(dateStr)!.push(c);
          });

          // 5. Pré-chargement des données nécessaires pour optimiser la vitesse
          // a. Infos Client (Une seule fois)
          let clientInfo: Client | undefined = commandesValides[0]?.client;
          if (!clientInfo || !clientInfo.typeClient) {
            try {
              const d = await getDoc(doc(db, 'clients', clientId));
              if (d.exists()) {
                clientInfo = { id: d.id, ...d.data() } as Client;
              }
            } catch (e) {
              console.warn('Erreur fetch client info:', e);
            }
          }

          // b. Tous les produits impliqués (Pour éviter getDoc en boucle)
          const allProduitIds = new Set<string>();
          commandesValides.forEach((c: CommandeClient) => c.produits.forEach((p: any) => allProduitIds.add(p.produitId)));
          
          const produitsCache = new Map<string, any>();
          if (allProduitIds.size > 0) {
            // Firestore ne permet pas de query IN avec plus de 10-30 éléments selon les cas,
            // mais ici on peut charger les plus fréquents ou tout simplement paralléliser les getDocs
            // car ils sont plus rapides en parallèle qu'en série dans une boucle.
            const ids = Array.from(allProduitIds);
            await Promise.all(ids.map(async (id) => {
              try {
                const pDoc = await getDoc(doc(db, 'produits', id));
                if (pDoc.exists()) {
                  const d = pDoc.data();
                  produitsCache.set(id, {
                    id: pDoc.id,
                    ...d,
                    prixClient: d.prixClient || 0,
                    prixBoutique: d.prixBoutique || 0,
                    prixUnitaire: d.prixUnitaire || 0
                  } as any);
                }
              } catch (e) { console.error(`Erreur cache produit ${id}:`, e); }
            }));
          }

          const misesAJour: Facture[] = [];
          const nouvelles: Facture[] = [];

          // 6. Itérer sur chaque date
          for (const [dateStr, commandesJour] of commandesParDate) {
            const dateObj = new Date(dateStr);
            const factureExistante = facturesExistantes.find(f => f.dateLivraison.toISOString().split('T')[0] === dateStr);

            // Si facture bloquée, skip
            if (factureExistante && ['payee', 'envoyee', 'annulee'].includes(factureExistante.statut)) {
              continue;
            }

            const retoursJour = retours.filter(r => r.dateLivraison.toISOString().split('T')[0] === dateStr);
            const retoursCompletes = get().verifierRetoursCompletes(clientId, dateObj, retoursJour);

            // Calcul lignes
            const lignesMap = new Map<string, LigneFacture>();

            for (const cmd of commandesJour) {
              for (const pCmd of cmd.produits) {
                let qte = Object.values(pCmd.repartitionCars || {}).reduce((s, q) => s + (Number(q) || 0), 0);
                if (qte === 0 && Number(pCmd.quantiteCommandee) > 0) {
                  qte = Number(pCmd.quantiteCommandee);
                }
                if (qte <= 0) continue;

                // Utiliser le cache
                const produitRef: any = produitsCache.get(pCmd.produitId) || pCmd.produit || {
                  id: pCmd.produitId,
                  nom: (pCmd as any).nomProduit || 'Produit',
                  prixUnitaire: Number(pCmd.prixUnitaire) || 0
                };
                
                // Prix selon commande d'abord, puis type client
                let prixUnitaire = Number(pCmd.prixUnitaire) || 0;
                if (!prixUnitaire || prixUnitaire <= 0) {
                  prixUnitaire = (clientInfo?.typeClient === 'client')
                    ? (Number(produitRef.prixClient) || Number(produitRef.prixUnitaire) || 0)
                    : (Number(produitRef.prixBoutique) || Number(produitRef.prixUnitaire) || 0);
                }

                if (lignesMap.has(pCmd.produitId)) {
                  const l = lignesMap.get(pCmd.produitId)!;
                  l.quantiteLivree += qte;
                  if (prixUnitaire > 0 && l.prixUnitaire === 0) {
                    l.prixUnitaire = prixUnitaire;
                  }
                } else {
                  // Chercher retour pour ce produit
                  const retourProd = retoursJour.find(r => r.produits.some(rp => rp.produitId === pCmd.produitId));
                  const retourItem = retourProd?.produits.find(rp => rp.produitId === pCmd.produitId);
                  const qteRetour = retourItem?.invendus || 0;

                  lignesMap.set(pCmd.produitId, {
                    produitId: pCmd.produitId,
                    produit: {
                      ...produitRef,
                      prixUnitaire,
                      prixClient: produitRef.prixClient || prixUnitaire
                    },
                    quantiteLivree: qte,
                    quantiteRetournee: qteRetour,
                    quantiteFacturee: 0,
                    prixUnitaire,
                    montantLigne: 0
                  });
                }
              }
            }

            // Finaliser lignes
            const lignes = Array.from(lignesMap.values()).map(l => {
              const retourGlob = retoursJour.flatMap(r => r.produits).find(rp => rp.produitId === l.produitId);
              if (retourGlob) l.quantiteRetournee = retourGlob.invendus || 0;

              l.quantiteFacturee = Math.max(0, l.quantiteLivree - l.quantiteRetournee);
              l.montantLigne = l.quantiteFacturee * l.prixUnitaire;
              return l;
            });

            if (lignes.length === 0) continue;

            // Préparer les données pour Firestore (nettoyage des undefined)
            const lignesClean = lignes.map(l => ({
              produitId: l.produitId,
              quantiteLivree: l.quantiteLivree,
              quantiteRetournee: l.quantiteRetournee,
              quantiteFacturee: l.quantiteFacturee,
              prixUnitaire: l.prixUnitaire,
              montantLigne: l.montantLigne,
              produit: l.produit ? {
                id: (l.produit as any).id,
                nom: (l.produit as any).nom,
                prixUnitaire: (l.produit as any).prixUnitaire || 0,
                prixClient: (l.produit as any).prixClient || 0,
                prixBoutique: (l.produit as any).prixBoutique || 0
              } : null
            }));

            const clientClean = clientInfo ? {
              id: clientInfo.id,
              nom: clientInfo.nom,
              adresse: clientInfo.adresse || '',
              telephone: clientInfo.telephone || '',
              email: clientInfo.email || '',
              typeClient: clientInfo.typeClient,
            } : null;

            const totaux = get().calculerTotauxFacture(lignes, params.tauxTVADefaut);

            let soldeUtilise = 0;
            if (factureExistante) soldeUtilise = factureExistante.soldeUtilise || 0;

            const netAPayer = Math.max(0, totaux.totalTTC - soldeUtilise);

            // Données de mise à jour pour Firestore
            const updatesFirestore = {
              client: clientClean,
              lignes: lignesClean,
              ...totaux,
              soldeUtilise,
              netAPayer,
              statut: retoursCompletes ? 'validee' : 'en_attente_retours',
              retoursCompletes,
              updatedAt: new Date()
            } as any;

            if (factureExistante) {
              if (retoursCompletes && factureExistante.statut !== 'validee') updatesFirestore.validatedAt = new Date();
              await updateDoc(doc(db, 'factures', factureExistante.id), updatesFirestore);

              // Mettre à jour dans le state local avec les objets complets
              misesAJour.push({
                ...factureExistante,
                ...updatesFirestore,
                lignes,
                client: clientInfo
              });
            } else {
              const dateKey = dateObj.toISOString().split('T')[0];
              const newId = `facture_${clientId}_${dateKey}`;

              const newFactureForUI = {
                id: newId,
                numeroFacture: get().genererNumeroFacture(dateObj),
                clientId,
                client: clientInfo,
                dateLivraison: dateObj,
                dateFacture: new Date(),
                lignes,
                ...totaux,
                soldeUtilise,
                netAPayer,
                statut: retoursCompletes ? 'validee' : 'en_attente_retours',
                retoursCompletes,
                createdAt: new Date(),
                updatedAt: new Date(),
                conditionsPaiement: clientInfo?.conditionsPaiement || params.conditionsPaiementDefaut,
                tauxTVA: params.tauxTVADefaut
              };

              const newFactureForFirestore = {
                ...newFactureForUI,
                lignes: lignesClean,
                client: clientClean
              };

              await setDoc(doc(db, 'factures', newId), newFactureForFirestore, { merge: true });
              nouvelles.push(newFactureForUI as Facture);
            }
          }

          set(state => {

            const facturesMisesAJour = state.factures.map(f => {
              const updated = misesAJour.find(u => u.id === f.id);
              return updated || f;
            });

            // Ajouter les nouvelles et dédupliquer par ID
            const toutesLesFactures = [...facturesMisesAJour, ...nouvelles];
            const facturesUniques = Array.from(new Map(toutesLesFactures.map(f => [f.id, f])).values());

            return {
              factures: facturesUniques,
              isLoading: false
            };
          });


        } catch (error) {
          console.error(error);
          set({ isLoading: false });
          throw error;
        }
      },

      chargerFactures: async (dateDebut?: Date, dateFin?: Date, background: boolean = false) => {
        // Tenter de vider la file d'attente si le quota est revenu
        flushSyncQueue().catch(() => {});

        if (!background) set({ isLoading: true });

        try {
          let facturesQuery = collection(db, 'factures');

          if (dateDebut && dateFin) {
            facturesQuery = query(
              collection(db, 'factures'),
              where('dateLivraison', '>=', dateDebut),
              where('dateLivraison', '<=', dateFin)
            ) as any;
          } else {
            facturesQuery = query(
              collection(db, 'factures'),
              orderBy('dateFacture', 'desc'),
              limit(60)
            ) as any;
          }

          const facturesSnapshot = await getDocs(facturesQuery);

          if (!facturesSnapshot.empty) {
            const facturesData = facturesSnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                ...data,
                dateLivraison: data.dateLivraison?.toDate ? data.dateLivraison.toDate() : new Date(data.dateLivraison),
                dateFacture: data.dateFacture?.toDate ? data.dateFacture.toDate() : new Date(data.dateFacture),
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
                validatedAt: data.validatedAt ? (data.validatedAt.toDate ? data.validatedAt.toDate() : new Date(data.validatedAt)) : undefined,
                paidAt: data.paidAt ? (data.paidAt.toDate ? data.paidAt.toDate() : new Date(data.paidAt)) : undefined,
                reglements: data.reglements ? data.reglements.map((r: any) => ({
                  ...r,
                  date: r.date && typeof r.date.toDate === 'function' ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
                })) : undefined,
              } as Facture;
            });

            // Tri par date de facture décroissante en mémoire (évite index composite Firestore)
            facturesData.sort((a, b) => (b.dateFacture?.getTime() || 0) - (a.dateFacture?.getTime() || 0));

            // Déduplication par ID pour éviter les doublons
            const facturesUniques = Array.from(
              new Map(facturesData.map(f => [f.id, f])).values()
            );

            set({ factures: facturesUniques });
          } else {
            set({ factures: [] });
          }

          if (!background) set({ isLoading: false });
        } catch (error) {
          if (!background) set({ isLoading: false });
          console.error('❌ Erreur lors du chargement des factures:', error);
          throw error;
        }
      },

      chargerFacturesAvecListener: (dateDebut?: Date, dateFin?: Date) => {
        console.log('📡 Configuration listener temps réel pour factures');

        // Nettoyer le listener précédent s'il existe
        const { facturesListener } = get();
        if (facturesListener) {
          facturesListener();
        }

        set({ isLoading: true });

        // Configurer le nouveau listener
        const unsubscribe = realTimeListeners.subscribeToFactures((factures) => {
          console.log('🔄 Mise à jour temps réel - factures reçues:', factures.length);
          set({
            factures,
            isLoading: false
          });
        }, dateDebut, dateFin);

        // Stocker la fonction de nettoyage
        set({ facturesListener: unsubscribe });
      },

      chargerFacture: async (factureId: string) => {
        set({ isLoading: true });

        try {
          const docRef = doc(db, 'factures', factureId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const facture: Facture = {
              ...data,
              dateLivraison: data.dateLivraison.toDate(),
              dateFacture: data.dateFacture.toDate(),
              createdAt: data.createdAt.toDate(),
              updatedAt: data.updatedAt.toDate(),
              validatedAt: data.validatedAt ? data.validatedAt.toDate() : undefined,
              paidAt: data.paidAt ? data.paidAt.toDate() : undefined,
              reglements: data.reglements ? data.reglements.map((r: any) => ({
                ...r,
                date: r.date && typeof r.date.toDate === 'function' ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
              })) : undefined,
            } as Facture;

            set({ factureActive: facture });
          } else {
            throw new Error('Facture non trouvée');
          }

          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          console.error('❌ Erreur lors du chargement de la facture:', error);
          throw error;
        }
      },

      validerFacture: async (factureId: string) => {
        try {
          const factureRef = doc(db, 'factures', factureId);
          const updateData = {
            statut: 'validee' as const,
            validatedAt: new Date(),
            updatedAt: new Date()
          };

          // LOGIQUE DE DÉDUCTION DU SOLDE EST MAINTENANT DANS LA GÉNÉRATION DE FACTURE
          // On ne déduit pas ici pour éviter les doublons si l'utilisateur régénère ou valide manuellement.
          // La déduction se fait au moment de la création/mise à jour de la facture (réservation du solde).

          await updateDoc(factureRef, updateData);

          // Mettre à jour localement
          set(state => ({
            factures: state.factures.map(f =>
              f.id === factureId
                ? { ...f, ...updateData }
                : f
            ),
            factureActive: state.factureActive?.id === factureId
              ? { ...state.factureActive, ...updateData }
              : state.factureActive
          }));

        } catch (error) {
          console.error('❌ Erreur lors de la validation:', error);
          throw error;
        }
      },

      envoyerFacture: async (factureId: string) => {
        try {
          const updateData = {
            statut: 'envoyee' as const,
            updatedAt: new Date()
          };

          await updateDoc(doc(db, 'factures', factureId), updateData);

          set(state => ({
            factures: state.factures.map(f =>
              f.id === factureId ? { ...f, ...updateData } : f
            ),
            factureActive: state.factureActive?.id === factureId
              ? { ...state.factureActive, ...updateData }
              : state.factureActive
          }));

        } catch (error) {
          console.error('❌ Erreur lors de l\'envoi:', error);
          throw error;
        }
      },

      marquerPayee: async (factureId: string, input: Reglement[] | { montant: number, mode: ModePaiement, date?: Date }) => {
        try {
          const facture = get().factures.find(f => f.id === factureId);
          if (!facture) throw new Error("Facture introuvable");

          const nouveauxReglements: Reglement[] = (Array.isArray(input) ? input : [{
            id: `reg_${Date.now()}`,
            montant: input.montant,
            mode: input.mode,
            date: input.date || new Date()
          }]).map((r: any) => ({
            ...r,
            date: r.date && typeof r.date.toDate === 'function' ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
          }));

          // Récupérer et nettoyer les anciens règlements
          const anciensReglements = (facture.reglements || []).map((r: any) => ({
            ...r,
            date: r.date && typeof r.date.toDate === 'function' ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
          }));

          // Fusionner les règlements
          const reglements = [...anciensReglements, ...nouveauxReglements];

          const totalVerse = reglements.reduce((sum, r) => sum + r.montant, 0);
          const montantAttendu = facture.netAPayer ?? facture.totalTTC;

          const isTotalPaye = totalVerse >= montantAttendu;

          const updateData: any = {
            statut: isTotalPaye ? 'payee' : 'partiellement_payee',
            paidAt: isTotalPaye ? reglements[reglements.length - 1].date : null,
            montantRegle: totalVerse,
            reglements: reglements,
            modePaiement: reglements[0]?.mode || 'espece', // Principal mode (le premier saisi)
            updatedAt: new Date()
          };

          // Gestion du surplus (Avoir/Solde) sur la transaction courante uniquement
          const nouveauVersement = nouveauxReglements.reduce((sum, r) => sum + r.montant, 0);
          const resteAEncasser = Math.max(0, montantAttendu - (facture.montantRegle || 0));
          const surplus = Math.max(0, nouveauVersement - resteAEncasser);

          // 1. Mise à jour immédiate de l'état local (optimistic)
          set(state => ({
            factures: state.factures.map(f =>
              f.id === factureId ? { ...f, ...updateData } : f
            ),
            factureActive: state.factureActive?.id === factureId
              ? { ...state.factureActive, ...updateData }
              : state.factureActive
          }));
          console.log(`✅ Règlement enregistré en local pour facture: ${facture.numeroFacture || factureId}`);

          // 2. Synchronisation Firebase protégée avec timeout et tolérance quota
          try {
            if (surplus > 0) {
              const clientRef = doc(db, 'clients', facture.clientId);
              getDoc(clientRef).then(clientDoc => {
                if (clientDoc.exists()) {
                  const soldeActuel = clientDoc.data().solde || 0;
                  const nouveauSolde = soldeActuel + surplus;
                  updateDoc(clientRef, { solde: nouveauSolde }).catch(e => console.warn("Erreur mise à jour avoir client:", e));
                  console.log(`💰 Avoir généré: +${surplus} FCFA (Nouveau solde: ${nouveauSolde})`);
                }
              }).catch(e => console.warn("Erreur lecture client pour avoir:", e));
            }

            await Promise.race([
              updateDoc(doc(db, 'factures', factureId), updateData),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
            ]);

            // Journal des règlements (non bloquant)
            Promise.allSettled(nouveauxReglements.map(r =>
              setDoc(doc(db, 'reglements', `${factureId}_${r.id}`), {
                factureId,
                clientId: facture.clientId,
                mode: r.mode,
                montant: r.montant,
                date: r.date,
                reference: (r as any).reference || null,
              })
            )).catch(() => {});

            console.log(`☁️ Règlement synchronisé avec succès sur Firestore`);
          } catch (err: any) {
            console.warn(`⚠️ Quota Firestore ou réseau inaccessible lors du règlement (conservé en local):`, err?.message || err);
            addToSyncQueue({
              type: 'paiement_facture',
              data: {
                factureId,
                updateData,
                nouveauxReglements,
                clientId: facture.clientId
              }
            });
          }

        } catch (error) {
          console.error('❌ Erreur lors du marquage du paiement:', error);
          throw error;
        }
      },

      getReglementsPeriode: async (debut: Date, fin: Date) => {
        try {
          const q = query(collection(db, 'reglements'), where('date', '>=', debut), where('date', '<=', fin));
          const snap = await getDocs(q);
          return snap.docs.map(d => {
            const x = d.data() as any;
            return {
              mode: x.mode as ModePaiement,
              montant: x.montant || 0,
              date: x.date?.toDate ? x.date.toDate() : new Date(x.date),
              factureId: x.factureId,
              clientId: x.clientId,
            };
          });
        } catch (e) {
          console.error('Erreur getReglementsPeriode:', e);
          return [];
        }
      },

      getReglementsClientPeriode: async (clientId: string, debut: Date, fin: Date) => {
        try {
          const q = query(collection(db, 'reglements'), where('clientId', '==', clientId));
          const snap = await getDocs(q);
          return snap.docs
            .map(d => {
              const x = d.data() as any;
              return {
                id: d.id,
                mode: x.mode as ModePaiement,
                montant: x.montant || 0,
                date: x.date?.toDate ? x.date.toDate() : new Date(x.date),
                factureId: x.factureId,
                clientId: x.clientId,
                reference: x.reference || null,
              };
            })
            .filter(r => r.date >= debut && r.date <= fin)
            .sort((a, b) => b.date.getTime() - a.date.getTime());
        } catch (e) {
          console.error('Erreur getReglementsClientPeriode:', e);
          return [];
        }
      },

      getFacturesClient: async (clientId: string) => {
        try {
          const q = query(collection(db, 'factures'), where('clientId', '==', clientId), limit(100));
          const snap = await getDocs(q);
          return snap.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              dateLivraison: data.dateLivraison?.toDate ? data.dateLivraison.toDate() : new Date(data.dateLivraison),
              dateFacture: data.dateFacture?.toDate ? data.dateFacture.toDate() : new Date(data.dateFacture),
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
            } as Facture;
          });
        } catch (e) {
          console.error("Erreur getFacturesClient:", e);
          return [];
        }
      },

      getVentesFactureParProduit: async (debut: Date, fin: Date, payeesUniquement = false) => {
        const res: Record<string, { qty: number; valeur: number }> = {};
        try {
          const q = query(
            collection(db, 'factures'),
            where('dateLivraison', '>=', debut),
            where('dateLivraison', '<=', fin)
          );
          const snap = await getDocs(q);
          snap.docs.forEach(d => {
            const f = d.data() as any;
            // Exclure brouillons et annulées (pas de vente réelle)
            if (f.statut === 'annulee' || f.statut === 'brouillon') return;
            if (payeesUniquement && f.statut !== 'payee') return;
            (f.lignes || []).forEach((l: any) => {
              const qty = l.quantiteFacturee || 0;
              if (qty <= 0) return;
              if (!res[l.produitId]) res[l.produitId] = { qty: 0, valeur: 0 };
              res[l.produitId].qty += qty;
              res[l.produitId].valeur += (l.montantLigne != null ? l.montantLigne : qty * (l.prixUnitaire || 0));
            });
          });
        } catch (e) {
          console.error('getVentesFactureParProduit:', e);
        }
        return res;
      },

      getVentesFactureDetaillees: async (debut: Date, fin: Date, payeesUniquement = false) => {
        const lignes: Array<{
          date: string;
          clientId: string;
          clientNom: string;
          numeroFacture: string;
          produitId: string;
          nomProduit?: string;
          quantite: number;
          prixUnitaire: number;
          montant: number;
          statut: string;
        }> = [];
        try {
          const q = query(
            collection(db, 'factures'),
            where('dateLivraison', '>=', debut),
            where('dateLivraison', '<=', fin)
          );
          const snap = await getDocs(q);
          snap.docs.forEach(d => {
            const f = d.data() as any;
            if (f.statut === 'annulee' || f.statut === 'brouillon') return;
            if (payeesUniquement && f.statut !== 'payee') return;

            let dateStr = '';
            const dl = f.dateLivraison;
            if (dl?.toDate && typeof dl.toDate === 'function') {
              dateStr = dl.toDate().toISOString().split('T')[0];
            } else if (typeof dl?.seconds === 'number') {
              dateStr = new Date(dl.seconds * 1000).toISOString().split('T')[0];
            } else if (dl instanceof Date) {
              dateStr = isNaN(dl.getTime()) ? '' : dl.toISOString().split('T')[0];
            } else if (typeof dl === 'string') {
              dateStr = dl.split('T')[0];
            }

            const clientNom = f.client?.nomCommercial || f.client?.nom || f.clientNom || '';

            (f.lignes || []).forEach((l: any) => {
              const qty = l.quantiteFacturee || 0;
              if (qty <= 0) return;
              const pu = l.prixUnitaire || 0;
              const montant = l.montantLigne != null ? l.montantLigne : qty * pu;
              lignes.push({
                date: dateStr,
                clientId: f.clientId || '',
                clientNom,
                numeroFacture: f.numeroFacture || d.id,
                produitId: l.produitId,
                nomProduit: l.produit?.nom || l.nomProduit,
                quantite: qty,
                prixUnitaire: pu,
                montant,
                statut: f.statut || '',
              });
            });
          });
        } catch (e) {
          console.error('getVentesFactureDetaillees:', e);
        }
        return lignes;
      },

      getPremiereDateVenteLivraison: async () => {
        try {
          const q = query(collection(db, 'factures'), orderBy('dateLivraison', 'asc'), limit(1));
          const snap = await getDocs(q);
          if (snap.empty) return null;
          const d: any = (snap.docs[0].data() as any).dateLivraison;
          const date: Date | null = d?.toDate ? d.toDate() : (typeof d?.seconds === 'number' ? new Date(d.seconds * 1000) : (d ? new Date(d) : null));
          if (!date || isNaN(date.getTime())) return null;
          const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), j = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${j}`;
        } catch (e) {
          console.error('getPremiereDateVenteLivraison:', e);
          return null;
        }
      },

      backfillReglementsJournal: async () => {
        try {
          const snap = await getDocs(query(collection(db, 'factures'), limit(50)));
          const ops: Promise<any>[] = [];
          let n = 0;
          snap.docs.forEach(d => {
            const f = d.data() as any;
            (f.reglements || []).forEach((r: any) => {
              if (!r?.id) return;
              const date = r.date?.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : null);
              if (!date) return;
              ops.push(setDoc(doc(db, 'reglements', `${d.id}_${r.id}`), {
                factureId: d.id,
                clientId: f.clientId,
                mode: r.mode,
                montant: r.montant,
                date,
                reference: r.reference || null,
              }));
              n++;
            });
          });
          await Promise.all(ops);
          console.log(`✅ Journal règlements alimenté : ${n} règlement(s)`);
          return n;
        } catch (e) {
          console.error('Erreur backfill règlements:', e);
          return 0;
        }
      },

      annulerFacture: async (factureId: string, motif?: string) => {
        try {
          const updateData = {
            statut: 'annulee' as const,
            notes: motif || 'Facture annulée',
            updatedAt: new Date()
          };

          // REMBOURSEMENT DU SOLDE SI UTILISÉ
          const facture = get().factures.find(f => f.id === factureId);
          if (facture && facture.soldeUtilise && facture.soldeUtilise > 0) {
            try {
              const clientRef = doc(db, 'clients', facture.clientId);
              const snap = await getDoc(clientRef);
              if (snap.exists()) {
                const s = snap.data().solde || 0;
                await updateDoc(clientRef, { solde: s + facture.soldeUtilise });
                console.log(`💰 Remboursement solde suite annulation: +${facture.soldeUtilise}`);
              }
            } catch (e) {
              console.error("Erreur remboursement solde:", e);
            }
          }

          await updateDoc(doc(db, 'factures', factureId), updateData);

          // Supprimer les règlements associés de la collection 'reglements'
          try {
            const qRegs = query(collection(db, 'reglements'), where('factureId', '==', factureId));
            const snapRegs = await getDocs(qRegs);
            await Promise.all(snapRegs.docs.map(d => deleteDoc(d.ref)));
            console.log(`🗑️ Règlements associés à la facture annulée ${factureId} supprimés.`);
          } catch (e) {
            console.error('Erreur suppression règlements facture annulée:', e);
          }

          set(state => ({
            factures: state.factures.map(f =>
              f.id === factureId ? { ...f, ...updateData } : f
            )
          }));

        } catch (error) {
          console.error('❌ Erreur lors de l\'annulation:', error);
          throw error;
        }
      },

      supprimerFacture: async (factureId: string) => {
        try {
          // REMBOURSEMENT DU SOLDE SI UTILISÉ (Même logique que annulation)
          const facture = get().factures.find(f => f.id === factureId);
          if (facture && facture.soldeUtilise && facture.soldeUtilise > 0) {
            try {
              const clientRef = doc(db, 'clients', facture.clientId);
              const snap = await getDoc(clientRef);
              if (snap.exists()) {
                const s = snap.data().solde || 0;
                await updateDoc(clientRef, { solde: s + facture.soldeUtilise });
                console.log(`💰 Remboursement solde suite suppression: +${facture.soldeUtilise}`);
              }
            } catch (e) {
              console.error("Erreur remboursement solde:", e);
            }
          }

          await deleteDoc(doc(db, 'factures', factureId));

          // Supprimer les règlements associés de la collection 'reglements'
          try {
            const qRegs = query(collection(db, 'reglements'), where('factureId', '==', factureId));
            const snapRegs = await getDocs(qRegs);
            await Promise.all(snapRegs.docs.map(d => deleteDoc(d.ref)));
            console.log(`🗑️ Règlements associés à la facture supprimée ${factureId} supprimés.`);
          } catch (e) {
            console.error('Erreur suppression règlements facture supprimée:', e);
          }

          set(state => ({
            factures: state.factures.filter(f => f.id !== factureId),
            factureActive: state.factureActive?.id === factureId ? null : state.factureActive
          }));

        } catch (error) {
          console.error('❌ Erreur lors de la suppression:', error);
          throw error;
        }
      },

      ajouterAvoirClient: async (clientId: string, montant: number) => {
        try {
          const clientRef = doc(db, 'clients', clientId);
          const snap = await getDoc(clientRef);

          if (snap.exists()) {
            const soldeActuel = snap.data().solde || 0;
            const nouveauSolde = soldeActuel + montant;

            await updateDoc(clientRef, {
              solde: nouveauSolde,
              updatedAt: new Date()
            });
            console.log(`💰 Avoir ajouté pour client ${clientId}: +${montant} (Nouveau solde: ${nouveauSolde})`);
          }
        } catch (error) {
          console.error('❌ Erreur ajout avoir:', error);
          throw error;
        }
      },

      // Actions Paramètres
      chargerParametres: async () => {
        try {

          const docRef = doc(db, 'parametres', 'facturation');
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const parametresExistants = docSnap.data() as ParametresFacturation;
            // Forcer la mise à jour du taux TVA à 0 si il est encore à 18
            if (parametresExistants.tauxTVADefaut === 18) {
              parametresExistants.tauxTVADefaut = 0;
              await setDoc(docRef, parametresExistants);
            }
            set({ parametres: parametresExistants });
          } else {
            // Créer des paramètres par défaut
            const parametresDefaut: ParametresFacturation = {
              id: 'facturation',
              tauxTVADefaut: 0, // TVA désactivée par défaut
              conditionsPaiementDefaut: 'Payable à 30 jours',
              mentionsLegales: 'Boulangerie Chez MINA - Dakar, Sénégal - RC: XXXXX - NINEA: XXXXX',
              numeroFactureProchain: 1,
              prefixeFacture: 'FACT'
            };

            await setDoc(docRef, parametresDefaut);
            set({ parametres: parametresDefaut });
          }
        } catch (error) {
          console.error('❌ Erreur lors du chargement des paramètres:', error);
          throw error;
        }
      },

      sauvegarderParametres: async (nouveauxParametres: Partial<ParametresFacturation>) => {
        try {
          const { parametres } = get();
          if (!parametres) return;

          const parametresMisAJour = { ...parametres, ...nouveauxParametres };

          const docRef = doc(db, 'parametres', 'facturation');
          await setDoc(docRef, parametresMisAJour, { merge: true });

          set({ parametres: parametresMisAJour });
        } catch (error) {
          console.error('❌ Erreur lors de la sauvegarde des paramètres:', error);
          throw error;
        }
      },

      // Actions utilitaires
      calculerTotauxFacture: (lignes: LigneFacture[], tauxTVA: number) => {
        const totalHT = lignes.reduce((sum, ligne) => sum + ligne.montantLigne, 0);
        const montantTVA = Math.round(totalHT * (tauxTVA / 100) * 100) / 100;
        const totalTTC = Math.round((totalHT + montantTVA) * 100) / 100;

        return {
          totalHT: Math.round(totalHT * 100) / 100,
          montantTVA,
          totalTTC
        };
      },

      genererNumeroFacture: (date: Date) => {
        const { parametres } = get();
        if (!parametres) return 'FACT-001';

        const annee = date.getFullYear();
        const mois = (date.getMonth() + 1).toString().padStart(2, '0');
        const jour = date.getDate().toString().padStart(2, '0');
        const numero = parametres.numeroFactureProchain.toString().padStart(3, '0');

        return `${parametres.prefixeFacture}-${annee}${mois}${jour}-${numero}`;
      },

      verifierRetoursCompletes: (clientId: string, date: Date, retoursClients: InvendusClient[]) => {
        const targetDateStr = extraireDateCalendaire(date);
        if (!targetDateStr || !retoursClients || !Array.isArray(retoursClients)) return false;
        return retoursClients.some(retour =>
          retour.clientId === clientId &&
          extraireDateCalendaire(retour.dateLivraison) === targetDateStr &&
          retour.retoursCompletes === true
        );
      },

      // Setters
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setFactureActive: (facture: Facture | null) => {
        set({ factureActive: facture });
      },

      actualiserStatutsFactures: async (clientId?: string, date?: Date) => {
        try {
          const { factures } = get();
          
          // Si on a un client et une date, on cible uniquement cette facture
          if (clientId && date) {
            const dateStr = extraireDateCalendaire(date) || (date instanceof Date ? date.toISOString().split('T')[0] : String(date));
            const facture = factures.find(f => 
              f.clientId === clientId && 
              extraireDateCalendaire(f.dateLivraison) === dateStr
            );

            if (facture && !['payee', 'annulee'].includes(facture.statut)) {
              // Récupérer le retour direct
              let retour: InvendusClient | null = null;
              try {
                const docSnap = await getDoc(doc(db, 'clientReturns', `retours_${clientId}_${dateStr}`));
                if (docSnap.exists()) {
                  const d = docSnap.data();
                  retour = {
                    ...d,
                    id: docSnap.id,
                    dateLivraison: d.dateLivraison?.toDate ? d.dateLivraison.toDate() : new Date(d.dateLivraison)
                  } as InvendusClient;
                }
              } catch (_) {}

              if (!retour) {
                const invStore = useLivraisonStore.getState().invendusClients || [];
                retour = invStore.find(r => r.clientId === clientId && extraireDateCalendaire(r.dateLivraison) === dateStr) || null;
              }

              if (retour && retour.retoursCompletes) {
                const retoursMap = new Map<string, number>(
                  (retour.produits || []).map(p => [p.produitId, Number(p.invendus) || 0])
                );

                const nouvellesLignes = (facture.lignes || []).map(l => {
                  const qteRetour = retoursMap.get(l.produitId) || 0;
                  const qteLivree = Number(l.quantiteLivree) || 0;
                  const qteFacturee = Math.max(0, qteLivree - qteRetour);
                  const pu = Number(l.prixUnitaire) || 0;
                  return {
                    ...l,
                    quantiteLivree: qteLivree,
                    quantiteRetournee: qteRetour,
                    quantiteFacturee: qteFacturee,
                    montantLigne: qteFacturee * pu
                  };
                });

                let parametres = get().parametres;
                if (!parametres) {
                  try { await get().chargerParametres(); parametres = get().parametres; } catch (_) {}
                }
                const tauxTVA = facture.tauxTVA ?? (parametres?.tauxTVADefaut || 0);
                const totaux = get().calculerTotauxFacture(nouvellesLignes, tauxTVA);
                const soldeUtilise = facture.soldeUtilise || 0;
                const netAPayer = Math.max(0, totaux.totalTTC - soldeUtilise);

                const lignesClean = nouvellesLignes.map(l => {
                  const p = l.produit as any;
                  return {
                    produitId: l.produitId,
                    quantiteLivree: l.quantiteLivree,
                    quantiteRetournee: l.quantiteRetournee,
                    quantiteFacturee: l.quantiteFacturee,
                    prixUnitaire: l.prixUnitaire,
                    montantLigne: l.montantLigne,
                    produit: p ? {
                      id: p.id || l.produitId,
                      nom: p.nom || 'Produit',
                      prixUnitaire: p.prixUnitaire || l.prixUnitaire,
                      prixClient: p.prixClient || l.prixUnitaire,
                      prixBoutique: p.prixBoutique || l.prixUnitaire
                    } : null
                  };
                });

                const updateData: any = {
                  lignes: lignesClean,
                  ...totaux,
                  netAPayer,
                  statut: 'validee' as const,
                  retoursCompletes: true,
                  updatedAt: new Date()
                };
                if (facture.statut !== 'validee') {
                  updateData.validatedAt = new Date();
                }

                await updateDoc(doc(db, 'factures', facture.id), updateData);

                set(state => ({
                  factures: state.factures.map(f => f.id === facture.id ? { ...f, ...updateData, lignes: nouvellesLignes } : f)
                }));
                console.log(`✅ Facture ${facture.numeroFacture} actualisée avec retours`);
              }
            }
            return;
          }

          // Sinon, traitement par lot pour toutes les factures en attente (Background)
          const facturesEnAttente = factures.filter(f => f.statut === 'en_attente_retours');
          if (facturesEnAttente.length === 0) return;

          console.log(`🔄 Actualisation de ${facturesEnAttente.length} factures en attente...`);

          const timestamps = facturesEnAttente
            .map(f => f.dateLivraison?.getTime?.() || new Date(f.dateLivraison).getTime())
            .filter(t => !isNaN(t));
          if (timestamps.length === 0) return;

          const dateDebut = new Date(Math.min(...timestamps)); dateDebut.setHours(0, 0, 0, 0);
          const dateFin = new Date(Math.max(...timestamps)); dateFin.setHours(23, 59, 59, 999);

          const retoursSnap = await getDocs(query(
            collection(db, 'clientReturns'),
            where('dateLivraison', '>=', dateDebut),
            where('dateLivraison', '<=', dateFin)
          ));

          const retoursData = retoursSnap.docs.map(doc => ({
            ...doc.data(),
            dateLivraison: doc.data().dateLivraison?.toDate ? doc.data().dateLivraison.toDate() : new Date(doc.data().dateLivraison)
          })) as InvendusClient[];

          for (const facture of facturesEnAttente) {
            const d = facture.dateLivraison;
            const targetDateStr = extraireDateCalendaire(d);
            const matchingRetour = retoursData.find(r =>
              r.clientId === facture.clientId &&
              extraireDateCalendaire(r.dateLivraison) === targetDateStr &&
              r.retoursCompletes === true
            );

            if (matchingRetour) {
              const retoursMap = new Map<string, number>(
                (matchingRetour.produits || []).map(p => [p.produitId, Number(p.invendus) || 0])
              );

              const nouvellesLignes = (facture.lignes || []).map(l => {
                const qteRetour = retoursMap.get(l.produitId) || 0;
                const qteLivree = Number(l.quantiteLivree) || 0;
                const qteFacturee = Math.max(0, qteLivree - qteRetour);
                const pu = Number(l.prixUnitaire) || 0;
                return {
                  ...l,
                  quantiteLivree: qteLivree,
                  quantiteRetournee: qteRetour,
                  quantiteFacturee: qteFacturee,
                  montantLigne: qteFacturee * pu
                };
              });

              let parametres = get().parametres;
              if (!parametres) {
                try { await get().chargerParametres(); parametres = get().parametres; } catch (_) {}
              }
              const tauxTVA = facture.tauxTVA ?? (parametres?.tauxTVADefaut || 0);
              const totaux = get().calculerTotauxFacture(nouvellesLignes, tauxTVA);
              const soldeUtilise = facture.soldeUtilise || 0;
              const netAPayer = Math.max(0, totaux.totalTTC - soldeUtilise);

              const lignesClean = nouvellesLignes.map(l => {
                const p = l.produit as any;
                return {
                  produitId: l.produitId,
                  quantiteLivree: l.quantiteLivree,
                  quantiteRetournee: l.quantiteRetournee,
                  quantiteFacturee: l.quantiteFacturee,
                  prixUnitaire: l.prixUnitaire,
                  montantLigne: l.montantLigne,
                  produit: p ? {
                    id: p.id || l.produitId,
                    nom: p.nom || 'Produit',
                    prixUnitaire: p.prixUnitaire || l.prixUnitaire,
                    prixClient: p.prixClient || l.prixUnitaire,
                    prixBoutique: p.prixBoutique || l.prixUnitaire
                  } : null
                };
              });

              const updateData: any = {
                lignes: lignesClean,
                ...totaux,
                netAPayer,
                statut: 'validee' as const,
                retoursCompletes: true,
                updatedAt: new Date()
              };
              if (facture.statut !== 'validee') {
                updateData.validatedAt = new Date();
              }

              try {
                await updateDoc(doc(db, 'factures', facture.id), updateData);
              } catch (e) {
                console.warn('Erreur mise à jour facture Firestore:', e);
              }

              set(state => ({
                factures: state.factures.map(f => f.id === facture.id ? { ...f, ...updateData, lignes: nouvellesLignes } : f)
              }));
            }
          }
        } catch (error) {
          console.error('❌ Erreur lors de l\'actualisation des statuts:', error);
        }
      },

      modifierTauxTVA: async (factureId: string, nouveauTaux: number) => {
        try {
          const facture = get().factures.find(f => f.id === factureId);
          if (!facture) {
            throw new Error('Facture non trouvée');
          }

          // Recalculer les totaux avec le nouveau taux
          const nouveauxTotaux = get().calculerTotauxFacture(facture.lignes, nouveauTaux);

          const updateData = {
            tauxTVA: nouveauTaux,
            montantTVA: nouveauxTotaux.montantTVA,
            totalTTC: nouveauxTotaux.totalTTC,
            updatedAt: new Date()
          };

          // Mettre à jour dans Firebase
          await updateDoc(doc(db, 'factures', factureId), updateData);

          // Mettre à jour dans le state local
          set(state => ({
            factures: state.factures.map(f =>
              f.id === factureId ? { ...f, ...updateData } : f
            ),
            factureActive: state.factureActive?.id === factureId
              ? { ...state.factureActive, ...updateData }
              : state.factureActive
          }));

        } catch (error) {
          console.error('❌ Erreur lors de la modification du taux TVA:', error);
          throw error;
        }
      },

      nettoyerListeners: () => {
        const { facturesListener } = get();
        if (facturesListener) {
          facturesListener();
          set({ facturesListener: null });
          console.log('🧹 Listeners factures nettoyés');
        }
      },
    }),
    {
      name: 'facturation-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str, (_key, value) => {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
              return new Date(value);
            }
            return value;
          });
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({
        parametres: state.parametres,
      }) as unknown as FacturationStore,
    }
  )
);
