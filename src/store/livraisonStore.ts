import { create } from 'zustand';
import { collection, setDoc, getDoc, getDocs, query, where, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { LivraisonClient, InvendusClient, Client, Produit, ParametresLivraison } from '../types';

// Cache mémoire (session) des invendus sur période — évite les relectures Firestore rapprochées
let _invendusPeriodeCache: { key: string; at: number; data: InvendusClient[] } | null = null;

interface LivraisonStore {
  // État
  livraisonsJour: LivraisonClient[];
  invendusClients: InvendusClient[];
  parametresLivraison: ParametresLivraison | null;
  clients: Client[];
  produits: Produit[];
  isLoading: boolean;

  // Actions Paramètres Livraison
  chargerParametresLivraison: () => Promise<void>;
  sauvegarderParametresLivraison: (nouveauxParametres: Partial<ParametresLivraison>) => Promise<void>;

  // Actions Livraisons
  chargerLivraisonsDuJour: (date: Date) => Promise<void>;
  chargerInvendusDuJour: (date: Date) => Promise<void>;
  chargerInvendusPeriode: (debut: Date, fin: Date) => Promise<void>;
  commencerLivraison: (clientId: string) => void;
  terminerLivraison: (clientId: string) => void;

  // Actions Invendus
  saisirInvendusClient: (clientId: string, produitId: string, invendus: number) => void;
  calculerVenduClient: (clientId: string, produitId: string) => number;
  sauvegarderInvendus: () => Promise<void>;
  marquerAucunRetourClient: (clientId: string, date: Date) => Promise<void>;
  sauvegarderRetoursClient: (clientId: string, date: Date, produits: Array<{ produitId: string; produit: any; quantiteLivree: number; invendus: number; vendu: number }>) => Promise<void>;
  marquerTousSansRetour: (clientIds: string[], date: Date) => Promise<void>;
  annulerValidationRetours: (clientId: string, date: Date) => Promise<void>;
  supprimerInvendusClient: (clientId: string, date: Date) => Promise<void>;

  // Actions utilitaires
  getLivraisonByClientId: (clientId: string) => LivraisonClient | undefined;
  getInvendusByClientId: (clientId: string) => InvendusClient | undefined;

  // Setters
  setLoading: (loading: boolean) => void;
}

export const useLivraisonStore = create<LivraisonStore>((set, get) => ({
  // État initial
  livraisonsJour: [],
  invendusClients: [],
  parametresLivraison: null,
  clients: [],
  produits: [],
  isLoading: false,

  // Actions Paramètres Livraison
  chargerParametresLivraison: async () => {
    try {
      const docRef = doc(db, 'parametres', 'livraison');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as ParametresLivraison;
        set({ parametresLivraison: data });
      } else {
        const paramsDefaut: ParametresLivraison = {
          pourcentageRetourGlobalMax: 10
        };
        await setDoc(docRef, paramsDefaut);
        set({ parametresLivraison: paramsDefaut });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres de livraison:', error);
    }
  },

  sauvegarderParametresLivraison: async (nouveauxParametres: Partial<ParametresLivraison>) => {
    try {
      const { parametresLivraison } = get();
      const parametresMisAJour = {
        ...parametresLivraison,
        ...nouveauxParametres,
        updatedAt: new Date()
      };
      const docRef = doc(db, 'parametres', 'livraison');
      await setDoc(docRef, parametresMisAJour, { merge: true });
      set({ parametresLivraison: parametresMisAJour });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres de livraison:', error);
      throw error;
    }
  },

  // Actions Livraisons
  chargerLivraisonsDuJour: async (date: Date) => {
    set({ isLoading: true });
    try {
      // TODO: Charger depuis Firestore
      // - Récupérer le programme de production du jour
      // - Créer les livraisons à partir des commandes clients
      console.log('Charger livraisons du jour:', date);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  chargerInvendusDuJour: async (date: Date) => {
    set({ isLoading: true });
    const dateStr = date.toISOString().split('T')[0];
    try {
      console.log(`🔄 Chargement des invendus pour ${dateStr}...`);

      // Chercher tous les retours clients pour cette date
      const startDate = new Date(dateStr + 'T00:00:00.000Z');
      const endDate = new Date(dateStr + 'T23:59:59.999Z');

      const retoursQuery = query(
        collection(db, 'clientReturns'),
        where('dateLivraison', '>=', startDate),
        where('dateLivraison', '<=', endDate)
      );

      const retoursSnapshot = await getDocs(retoursQuery);

      if (!retoursSnapshot.empty) {
        const invendusData = retoursSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            dateLivraison: data.dateLivraison?.toDate ? data.dateLivraison.toDate() : new Date(data.dateLivraison),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          } as InvendusClient;
        });

        try {
          localStorage.setItem(`boulangerie_retours_${dateStr}`, JSON.stringify(invendusData));
        } catch (_) {}

        set({ invendusClients: invendusData, isLoading: false });
        console.log(`✅ ${invendusData.length} retours clients chargés depuis Firebase`);
      } else {
        // Vérifier si des retours sont en stockage local
        const local = localStorage.getItem(`boulangerie_retours_${dateStr}`);
        if (local) {
          try {
            const parsed = JSON.parse(local).map((inv: any) => ({
              ...inv,
              dateLivraison: new Date(inv.dateLivraison),
              createdAt: new Date(inv.createdAt),
              updatedAt: new Date(inv.updatedAt),
            }));
            set({ invendusClients: parsed, isLoading: false });
            console.log(`📦 ${parsed.length} retours clients restaurés depuis le stockage local`);
            return;
          } catch (_) {}
        }
        console.log(`ℹ️ Aucun retour client trouvé pour cette date`);
        set({ invendusClients: [], isLoading: false });
      }
    } catch (error) {
      // Secours en cas de quota Firestore dépassé
      const local = localStorage.getItem(`boulangerie_retours_${dateStr}`);
      if (local) {
        try {
          const parsed = JSON.parse(local).map((inv: any) => ({
            ...inv,
            dateLivraison: new Date(inv.dateLivraison),
            createdAt: new Date(inv.createdAt),
            updatedAt: new Date(inv.updatedAt),
          }));
          set({ invendusClients: parsed, isLoading: false });
          console.log(`📦 ${parsed.length} retours clients restaurés depuis le stockage local (secours quota)`);
          return;
        } catch (_) {}
      }
      set({ isLoading: false });
      console.warn(`⚠️ Erreur lors du chargement des invendus (quota ou réseau):`, error);
    }
  },

  chargerInvendusPeriode: async (debut: Date, fin: Date) => {
    const startDate = new Date(debut); startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(fin); endDate.setHours(23, 59, 59, 999);

    // Cache court (10 min) : évite de relire Firestore si on rouvre la carte peu après
    const key = `${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
    if (_invendusPeriodeCache && _invendusPeriodeCache.key === key && Date.now() - _invendusPeriodeCache.at < 10 * 60 * 1000) {
      set({ invendusClients: _invendusPeriodeCache.data });
      return;
    }

    set({ isLoading: true });
    try {
      const retoursQuery = query(
        collection(db, 'clientReturns'),
        where('dateLivraison', '>=', startDate),
        where('dateLivraison', '<=', endDate)
      );
      const snap = await getDocs(retoursQuery);
      const invendusData = snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          dateLivraison: data.dateLivraison.toDate(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
        } as InvendusClient;
      });
      _invendusPeriodeCache = { key, at: Date.now(), data: invendusData };
      set({ invendusClients: invendusData, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur chargement invendus période:', error);
    }
  },

  commencerLivraison: (clientId: string) => {
    set((state) => ({
      livraisonsJour: state.livraisonsJour.map(livraison =>
        livraison.clientId === clientId
          ? { ...livraison, statut: 'en_cours' as const }
          : livraison
      )
    }));
  },

  terminerLivraison: (clientId: string) => {
    set((state) => ({
      livraisonsJour: state.livraisonsJour.map(livraison =>
        livraison.clientId === clientId
          ? { ...livraison, statut: 'termine' as const }
          : livraison
      )
    }));
  },

  // Actions Invendus
  saisirInvendusClient: (clientId: string, produitId: string, invendus: number) => {
    const { livraisonsJour } = get();
    const livraison = livraisonsJour.find(l => l.clientId === clientId);

    if (!livraison) return;

    const produitLivraison = livraison.produits.find(p => p.produitId === produitId);
    if (!produitLivraison) return;

    // Calculer le vendu
    const vendu = produitLivraison.quantiteLivree - invendus;

    // Mettre à jour la livraison
    set((state) => ({
      livraisonsJour: state.livraisonsJour.map(l =>
        l.clientId === clientId
          ? {
            ...l,
            produits: l.produits.map(p =>
              p.produitId === produitId
                ? { ...p, invendus, vendu }
                : p
            )
          }
          : l
      )
    }));

    // Créer ou mettre à jour les invendus clients
    set((state) => {
      const existingInvendus = state.invendusClients.find(i => i.clientId === clientId);

      if (existingInvendus) {
        // Mettre à jour
        return {
          invendusClients: state.invendusClients.map(i =>
            i.clientId === clientId
              ? {
                ...i,
                produits: i.produits.map(p =>
                  p.produitId === produitId
                    ? {
                      ...p,
                      invendus,
                      vendu,
                      quantiteLivree: produitLivraison.quantiteLivree
                    }
                    : p
                )
              }
              : i
          )
        };
      } else {
        // Créer nouveau
        const nouveauInvendus: InvendusClient = {
          id: `inv_${clientId}_${Date.now()}`,
          clientId,
          client: livraison.client,
          dateLivraison: livraison.dateLivraison,
          produits: [{
            produitId,
            produit: produitLivraison.produit,
            quantiteLivree: produitLivraison.quantiteLivree,
            invendus,
            vendu
          }],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return {
          invendusClients: [...state.invendusClients, nouveauInvendus]
        };
      }
    });
  },

  calculerVenduClient: (clientId: string, produitId: string) => {
    const { livraisonsJour } = get();
    const livraison = livraisonsJour.find(l => l.clientId === clientId);

    if (!livraison) return 0;

    const produit = livraison.produits.find(p => p.produitId === produitId);
    if (!produit) return 0;

    return produit.quantiteLivree - produit.invendus;
  },

  sauvegarderInvendus: async () => {
    const { invendusClients } = get();
    set({ isLoading: true });

    try {
      console.log('🔄 Sauvegarde des invendus clients:', invendusClients);

      for (const invendus of invendusClients) {
        // Utiliser un ID prévisible basé sur client et date
        const dateStr = invendus.dateLivraison.toISOString().split('T')[0];
        const docId = `retours_${invendus.clientId}_${dateStr}`;

        // Préparer les données pour Firebase
        const firestoreData = {
          ...invendus,
          dateLivraison: invendus.dateLivraison,
          createdAt: invendus.createdAt,
          updatedAt: new Date()
        };

        console.log(`💾 Sauvegarde retours client vers document ID: ${docId}`);

        // Utiliser setDoc() avec merge pour créer ou mettre à jour
        const docRef = doc(db, 'clientReturns', docId);
        await setDoc(docRef, firestoreData, { merge: true });
      }

      console.log('✅ Tous les retours clients sauvegardés avec succès');
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors de la sauvegarde des invendus:', error);
      throw error;
    }
  },

  marquerAucunRetourClient: async (clientId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const docId = `retours_${clientId}_${dateStr}`;

    const retourVide: InvendusClient = {
      clientId,
      dateLivraison: date,
      produits: [], // Aucun produit avec retours
      retoursCompletes: true, // Marqué comme complété
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 1. Mettre à jour immédiatement le state local et le stockage de secours
    set(state => {
      const invendusFiltered = state.invendusClients.filter(inv =>
        !(inv.clientId === clientId && (inv.dateLivraison?.toDateString?.() === date.toDateString() || new Date(inv.dateLivraison).toDateString() === date.toDateString()))
      );
      const updated = [...invendusFiltered, retourVide];
      try {
        localStorage.setItem(`boulangerie_retours_${dateStr}`, JSON.stringify(updated));
      } catch (_) {}
      return {
        invendusClients: updated,
        isLoading: false
      };
    });

    console.log('✅ "Aucun retour" appliqué localement pour client:', clientId);

    // 2. Synchronisation Firebase avec tolérance quota & timeout
    try {
      const docRef = doc(db, 'clientReturns', docId);
      await Promise.race([
        setDoc(docRef, retourVide, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);
      console.log('☁️ "Aucun retour" synchronisé sur Firestore');
    } catch (error: any) {
      console.warn('⚠️ Quota Firestore ou réseau inaccessible lors du marquage sans retour (conservé en local):', error?.message || error);
    }
  },

  sauvegarderRetoursClient: async (clientId: string, date: Date, produits: Array<{ produitId: string; produit: any; quantiteLivree: number; invendus: number; vendu: number }>) => {
    const dateStr = date.toISOString().split('T')[0];
    const docId = `retours_${clientId}_${dateStr}`;

    const retourClient: InvendusClient = {
      clientId,
      dateLivraison: date,
      produits: produits,
      retoursCompletes: true, // Marqué comme complété pour la facturation
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 1. Mettre à jour immédiatement le state local et le stockage de secours
    set(state => {
      const invendusFiltered = state.invendusClients.filter(inv =>
        !(inv.clientId === clientId && (inv.dateLivraison?.toDateString?.() === date.toDateString() || new Date(inv.dateLivraison).toDateString() === date.toDateString()))
      );
      const updated = [...invendusFiltered, retourClient];
      try {
        localStorage.setItem(`boulangerie_retours_${dateStr}`, JSON.stringify(updated));
      } catch (_) {}
      return {
        invendusClients: updated,
        isLoading: false
      };
    });

    console.log('✅ Retours client sauvegardés localement avec succès');

    // 2. Synchronisation Firebase avec tolérance quota & timeout
    try {
      const docRef = doc(db, 'clientReturns', docId);
      await Promise.race([
        setDoc(docRef, retourClient, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);
      console.log('☁️ Retours client synchronisés sur Firestore');
    } catch (error: any) {
      console.warn('⚠️ Quota Firestore ou réseau inaccessible lors de la sauvegarde des retours (conservé en local):', error?.message || error);
    }
  },

  marquerTousSansRetour: async (clientIds: string[], date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const nouveauxRetours: InvendusClient[] = clientIds.map(clientId => ({
      clientId,
      dateLivraison: date,
      produits: [],
      retoursCompletes: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // 1. Mettre à jour immédiatement le state local
    set(state => {
      const invendusFiltered = state.invendusClients.filter(inv =>
        !(clientIds.includes(inv.clientId) && (inv.dateLivraison?.toDateString?.() === date.toDateString() || new Date(inv.dateLivraison).toDateString() === date.toDateString()))
      );
      const updated = [...invendusFiltered, ...nouveauxRetours];
      try {
        localStorage.setItem(`boulangerie_retours_${dateStr}`, JSON.stringify(updated));
      } catch (_) {}
      return {
        invendusClients: updated,
        isLoading: false
      };
    });

    console.log(`✅ Marquage groupé "aucun retour" appliqué localement pour ${clientIds.length} clients`);

    // 2. Synchronisation Firebase en arrière-plan
    try {
      const batch = writeBatch(db);
      clientIds.forEach(clientId => {
        const docId = `retours_${clientId}_${dateStr}`;
        const docRef = doc(db, 'clientReturns', docId);
        const retourVide: InvendusClient = {
          clientId,
          dateLivraison: date,
          produits: [],
          retoursCompletes: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        batch.set(docRef, retourVide, { merge: true });
      });

      await Promise.race([
        batch.commit(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      console.log('☁️ Batch "aucun retour" synchronisé sur Firestore');
    } catch (error: any) {
      console.warn('⚠️ Quota Firestore ou réseau inaccessible lors du batch sans retour (conservé en local):', error?.message || error);
    }
  },

  annulerValidationRetours: async (clientId: string, date: Date) => {
    set({ isLoading: true });

    try {
      console.log('🔓 Annulation validation retours pour client:', clientId);

      // Récupérer les données actuelles
      const { invendusClients } = get();
      const currentReturn = invendusClients.find(inv =>
        inv.clientId === clientId &&
        inv.dateLivraison.toISOString().split('T')[0] === date.toISOString().split('T')[0]
      );

      if (!currentReturn) return;

      const dateStr = date.toISOString().split('T')[0];
      const docId = `retours_${clientId}_${dateStr}`;

      const updatedReturn = {
        ...currentReturn,
        retoursCompletes: false,
        updatedAt: new Date()
      };

      // Mettre à jour Firebase
      // NOTE: On ne supprime pas, on met juste à jour le statut
      const docRef = doc(db, 'clientReturns', docId);
      await setDoc(docRef, updatedReturn, { merge: true });

      // Mettre à jour state local
      set(state => ({
        invendusClients: state.invendusClients.map(inv =>
          (inv.clientId === clientId && inv.dateLivraison.toISOString().split('T')[0] === dateStr)
            ? updatedReturn
            : inv
        ),
        isLoading: false
      }));

      console.log('✅ Validation retours annulée');

    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors de l\'annulation de la validation:', error);
      throw error;
    }
  },

  supprimerInvendusClient: async (clientId: string, date: Date) => {
    set({ isLoading: true });
    try {
      const dateStr = date.toISOString().split('T')[0];
      const docId = `retours_${clientId}_${dateStr}`;

      console.log(`🗑️ Suppression des invendus pour client ${clientId} date ${dateStr}, docId: ${docId}`);

      // Supprimer de Firebase
      await deleteDoc(doc(db, 'clientReturns', docId));

      // Supprimer de l'état local
      set(state => ({
        invendusClients: state.invendusClients.filter(inv =>
          !(inv.clientId === clientId &&
            new Date(inv.dateLivraison).toISOString().split('T')[0] === dateStr)
        ),
        isLoading: false
      }));

      console.log('✅ Invendus supprimés avec succès');
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors de la suppression des invendus:', error);
      throw error;
    }
  },

  // Actions utilitaires
  getLivraisonByClientId: (clientId: string) => {
    const { livraisonsJour } = get();
    return livraisonsJour.find(l => l.clientId === clientId);
  },

  getInvendusByClientId: (clientId: string) => {
    const { invendusClients } = get();
    return invendusClients.find(i => i.clientId === clientId);
  },

  // Setters
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));