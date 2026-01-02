import { create } from 'zustand';
import { collection, setDoc, getDocs, query, where, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { LivraisonClient, InvendusClient, Client, Produit } from '../types';

interface LivraisonStore {
  // État
  livraisonsJour: LivraisonClient[];
  invendusClients: InvendusClient[];
  clients: Client[];
  produits: Produit[];
  isLoading: boolean;

  // Actions Livraisons
  chargerLivraisonsDuJour: (date: Date) => Promise<void>;
  chargerInvendusDuJour: (date: Date) => Promise<void>;
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
  clients: [],
  produits: [],
  isLoading: false,

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
    try {
      const dateStr = date.toISOString().split('T')[0];
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
            dateLivraison: data.dateLivraison.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
          } as InvendusClient;
        });

        set({ invendusClients: invendusData });
        console.log(`✅ ${invendusData.length} retours clients chargés depuis Firebase`);
      } else {
        console.log(`ℹ️ Aucun retour client trouvé pour cette date`);
        set({ invendusClients: [] });
      }

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error(`❌ Erreur lors du chargement des invendus:`, error);
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
    set({ isLoading: true });

    try {
      console.log('✅ Marquage "aucun retour" pour client:', clientId, 'date:', date.toISOString().split('T')[0]);

      // Créer une entrée retour vide pour ce client
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

      // Sauvegarder dans Firebase
      const docRef = doc(db, 'clientReturns', docId);
      await setDoc(docRef, retourVide, { merge: true });

      // Mettre à jour le state local
      set(state => {
        // Supprimer l'ancien enregistrement s'il existe
        const invendusFiltered = state.invendusClients.filter(inv =>
          !(inv.clientId === clientId && inv.dateLivraison.toDateString() === date.toDateString())
        );

        // Ajouter le nouveau retour vide
        return {
          invendusClients: [...invendusFiltered, retourVide],
          isLoading: false
        };
      });

      console.log('✅ "Aucun retour" marqué avec succès');
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors du marquage "aucun retour":', error);
      throw error;
    }
  },

  sauvegarderRetoursClient: async (clientId: string, date: Date, produits: Array<{ produitId: string; produit: any; quantiteLivree: number; invendus: number; vendu: number }>) => {
    set({ isLoading: true });

    try {
      console.log('💾 Sauvegarde des retours pour client:', clientId, 'date:', date.toISOString().split('T')[0]);

      // Créer l'entrée retour pour ce client
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

      // Sauvegarder dans Firebase
      const docRef = doc(db, 'clientReturns', docId);
      await setDoc(docRef, retourClient, { merge: true });

      // Mettre à jour le state local
      set(state => {
        // Supprimer l'ancien enregistrement s'il existe
        const invendusFiltered = state.invendusClients.filter(inv =>
          !(inv.clientId === clientId && inv.dateLivraison.toDateString() === date.toDateString())
        );

        // Ajouter le nouveau retour
        return {
          invendusClients: [...invendusFiltered, retourClient],
          isLoading: false
        };
      });

      console.log('✅ Retours client sauvegardés et finalisés avec succès');
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors de la sauvegarde des retours client:', error);
      throw error;
    }
  },

  marquerTousSansRetour: async (clientIds: string[], date: Date) => {
    set({ isLoading: true });
    try {
      console.log('🚀 Marquage groupé "aucun retour" pour', clientIds.length, 'clients');
      const dateStr = date.toISOString().split('T')[0];
      const batch = writeBatch(db);
      const nouveauxRetours: InvendusClient[] = [];

      // Préparer les opérations batch
      clientIds.forEach(clientId => {
        const docId = `retours_${clientId}_${dateStr}`;
        const docRef = doc(db, 'clientReturns', docId);

        const retourVide: InvendusClient = {
          clientId,
          dateLivraison: date,
          produits: [], // Aucun produit avec retours
          retoursCompletes: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        batch.set(docRef, retourVide, { merge: true });
        nouveauxRetours.push(retourVide);
      });

      // Exécuter le batch
      await batch.commit();

      // Mettre à jour l'état local
      set(state => {
        // Supprimer les anciens enregistrements pour ces clients à cette date
        const invendusFiltered = state.invendusClients.filter(inv =>
          !(clientIds.includes(inv.clientId) && inv.dateLivraison.toDateString() === date.toDateString())
        );

        return {
          invendusClients: [...invendusFiltered, ...nouveauxRetours],
          isLoading: false
        };
      });

      console.log('✅ Batch "Aucun retour" exécuté avec succès');
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors du batch "aucun retour":', error);
      throw error;
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