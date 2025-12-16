import { create } from 'zustand';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { dateToTimestamp } from '../firebase/collections';
import type { StockBoutique, EquipeBoutique, VentesBoutique, Produit } from '../types';

interface BoutiqueStore {
  // État
  stockJour: StockBoutique | null;
  equipeMatin: EquipeBoutique | null;
  equipeSoir: EquipeBoutique | null;
  ventesJour: VentesBoutique | null;
  produits: Produit[];
  isLoading: boolean;

  // Actions Stock
  creerStockJour: (date: Date, produits: Array<{ produitId: string; stockDebut: number }>) => void;
  chargerStockJour: (date: Date) => Promise<void>;
  creerStockDepuisProduction: (date: Date, forceUpdate?: boolean) => Promise<void>;
  mettreAJourStockBoutique: (date: Date) => Promise<void>;

  // Actions Équipes
  commencerEquipeMatin: (vendeuse: string, date: Date) => void;
  commencerEquipeSoir: (vendeuse: string, date: Date) => void;
  saisirVenteMatin: (produitId: string, vendu: number) => void;
  saisirVenteSoir: (produitId: string, vendu: number) => void;
  terminerEquipeMatin: () => void;
  terminerEquipeSoir: () => void;

  // Actions Calculs
  calculerVentesBoutique: () => void;
  calculerResteMidi: (produitId: string) => number;
  calculerInvenduBoutique: (produitId: string) => number;

  // Actions Sauvegarde
  sauvegarderEquipe: (periode: 'matin' | 'soir') => Promise<void>;
  sauvegarderVentes: () => Promise<void>;

  // Actions Chargement
  chargerEquipe: (date: Date, periode: 'matin' | 'soir') => Promise<void>;
  chargerVentes: (date: Date) => Promise<void>;


  // Setters
  setLoading: (loading: boolean) => void;
}

// Debounce pour la sauvegarde automatique
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useBoutiqueStore = create<BoutiqueStore>((set, get) => ({
  // État initial
  stockJour: null,
  equipeMatin: null,
  equipeSoir: null,
  ventesJour: null,
  produits: [],
  isLoading: false,

  // Actions Stock
  creerStockJour: (date: Date, produits) => {
    const nouveauStock: StockBoutique = {
      id: `stock_${date.getTime()}`,
      date,
      produits: produits.map(p => ({
        produitId: p.produitId,
        stockDebut: p.stockDebut
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ stockJour: nouveauStock });
  },

  chargerStockJour: async (date: Date) => {
    set({ isLoading: true });
    try {
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      console.log('Recherche stock pour date (local):', dateStart.toLocaleString());

      const stockQuery = query(
        collection(db, 'shopStock'),
        where('date', '>=', dateToTimestamp(dateStart)),
        where('date', '<=', dateToTimestamp(dateEnd))
      );

      const stockSnapshot = await getDocs(stockQuery);
      console.log('Nombre de stocks trouvés:', stockSnapshot.docs.length);

      if (!stockSnapshot.empty) {
        const stockData = stockSnapshot.docs[0].data();
        console.log('Données stock brutes:', stockData);

        const stock: StockBoutique = {
          ...stockData,
          date: stockData.date.toDate(),
          createdAt: stockData.createdAt.toDate(),
          updatedAt: stockData.updatedAt.toDate(),
        } as StockBoutique;

        set({ stockJour: stock });
        console.log('Stock boutique chargé:', stock);
      } else {
        console.log('Aucun stock existant trouvé');
        set({ stockJour: null });
      }

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Erreur lors du chargement du stock:', error);
      throw error;
    }
  },

  creerStockDepuisProduction: async (date: Date, forceUpdate = false) => {
    set({ isLoading: true });
    try {
      // Récupérer le programme de production du jour
      // Utiliser les bornes locales pour correspondre à la création du programme
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      console.log('Plage de recherche production:', dateStart.toLocaleString(), 'à', dateEnd.toLocaleString());

      const programmeQuery = query(
        collection(db, 'productionPrograms'),
        where('dateProduction', '>=', dateToTimestamp(dateStart)),
        where('dateProduction', '<=', dateToTimestamp(dateEnd))
      );

      const programmeSnapshot = await getDocs(programmeQuery);
      console.log('Programmes trouvés:', programmeSnapshot.docs.length);

      if (programmeSnapshot.empty) {
        console.log('Aucun programme de production trouvé pour cette date');

        // Essayons aussi sans filtre de date pour voir tous les programmes
        const allProgrammesQuery = query(collection(db, 'productionPrograms'));
        const allProgrammes = await getDocs(allProgrammesQuery);
        console.log('Total programmes en base:', allProgrammes.docs.length);
        allProgrammes.docs.forEach(doc => {
          const data = doc.data();
          console.log('Programme trouvé:', doc.id, data.date);
        });

        set({ isLoading: false, stockJour: null });
        return;
      }

      const programmeData = programmeSnapshot.docs[0].data();
      const quantitesBoutique = programmeData.quantitesBoutique || [];

      console.log('Programme trouvé:', programmeData);
      console.log('Quantités boutique:', quantitesBoutique);

      // Si pas de quantités boutique définies
      if (quantitesBoutique.length === 0) {
        console.log('Aucune quantité boutique définie dans le programme');
        set({ isLoading: false, stockJour: null });
        return;
      }

      // Charger les produits pour avoir les noms
      const produitsSnapshot = await getDocs(collection(db, 'produits'));
      const produitsMap = new Map();
      produitsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        produitsMap.set(doc.id, data);
      });

      console.log('Produits chargés:', Array.from(produitsMap.keys()));

      // Créer le stock boutique basé sur les quantités boutique définies
      // Note: On ignore les quantités sans repartitionCars (anciennes données)
      const stockProduits = quantitesBoutique.map((qte: any) => {
        console.log('Traitement quantité:', qte);
        const produit = produitsMap.get(qte.produitId);
        console.log('Produit trouvé:', produit);

        return {
          produitId: qte.produitId,
          stockDebut: qte.quantite,
          produit: produit || { nom: 'Produit inconnu' },
          repartitionCars: qte.repartitionCars || null
        };
      }).filter((p: any) => p.stockDebut > 0);

      console.log('Stock produits final:', stockProduits);

      if (stockProduits.length === 0) {
        console.log('Aucun produit avec quantité > 0 pour la boutique');
        set({ isLoading: false, stockJour: null });
        return;
      }

      // Si forceUpdate ou pas de stock existant, créer/recréer le stock
      const { stockJour: stockExistant } = get();

      if (forceUpdate || !stockExistant) {
        // Créer le stock boutique
        const nouveauStock: StockBoutique = {
          id: `stock_${date.getTime()}`,
          date,
          produits: stockProduits,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Si un stock existant, le supprimer d'abord
        if (stockExistant && forceUpdate) {
          console.log('Suppression de l\'ancien stock pour mise à jour');
          // Trouver et supprimer l'ancien stock
          const oldStockQuery = query(
            collection(db, 'shopStock'),
            where('date', '>=', dateToTimestamp(dateStart)),
            where('date', '<=', dateToTimestamp(dateEnd))
          );
          const oldStockSnapshot = await getDocs(oldStockQuery);
          for (const doc of oldStockSnapshot.docs) {
            await deleteDoc(doc.ref);
          }
        }

        // Sauvegarder le nouveau stock en base
        await addDoc(collection(db, 'shopStock'), {
          ...nouveauStock,
          date: date,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        set({ stockJour: nouveauStock, isLoading: false });
        console.log('Stock boutique créé/mis à jour depuis les quantités définies:', nouveauStock);
      } else {
        // Stock existant, juste mettre à jour le state local
        set({ isLoading: false });
        console.log('Stock existant conservé');
      }

    } catch (error) {
      set({ isLoading: false, stockJour: null });
      console.error('Erreur lors de la création du stock depuis production:', error);
      // Ne pas throw l'erreur pour éviter les blocages
    }
  },

  // Nouvelle fonction pour forcer la mise à jour du stock
  mettreAJourStockBoutique: async (date: Date) => {
    await get().creerStockDepuisProduction(date, true);
  },

  // Actions Équipes
  commencerEquipeMatin: (vendeuse: string, date: Date) => {
    const { stockJour } = get();
    if (!stockJour) return;

    const nouvelleEquipe: EquipeBoutique = {
      id: `equipe_matin_${date.getTime()}`,
      date,
      periode: 'matin',
      vendeuse,
      produits: stockJour.produits.map(p => ({
        produitId: p.produitId,
        stockDebut: p.stockDebut,
        vendu: 0,
        reste: p.stockDebut,
        produit: p.produit
      })),
      statut: 'en_cours',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ equipeMatin: nouvelleEquipe });
  },

  commencerEquipeSoir: (vendeuse: string, date: Date) => {
    const { equipeMatin } = get();
    if (!equipeMatin) return;

    const nouvelleEquipe: EquipeBoutique = {
      id: `equipe_soir_${date.getTime()}`,
      date,
      periode: 'soir',
      vendeuse,
      produits: equipeMatin.produits.map(p => ({
        produitId: p.produitId,
        stockDebut: p.reste, // Le stock du soir = reste du matin
        vendu: 0,
        reste: p.reste,
        produit: p.produit
      })),
      statut: 'en_cours',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ equipeSoir: nouvelleEquipe });
  },

  saisirVenteMatin: (produitId: string, vendu: number) => {
    set((state) => {
      if (!state.equipeMatin) return state;

      return {
        equipeMatin: {
          ...state.equipeMatin,
          produits: state.equipeMatin.produits.map(p =>
            p.produitId === produitId
              ? {
                ...p,
                vendu,
                reste: p.stockDebut - vendu
              }
              : p
          ),
          updatedAt: new Date()
        }
      };
    });

    // Sauvegarde automatique avec debounce
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        console.log('💾 Sauvegarde automatique équipe matin...');
        await get().sauvegarderEquipe('matin');
      } catch (error) {
        console.error('❌ Erreur sauvegarde automatique matin:', error);
      }
    }, 2000); // Attendre 2 secondes après la dernière modification
  },

  saisirVenteSoir: (produitId: string, vendu: number) => {
    set((state) => {
      if (!state.equipeSoir) return state;

      return {
        equipeSoir: {
          ...state.equipeSoir,
          produits: state.equipeSoir.produits.map(p =>
            p.produitId === produitId
              ? {
                ...p,
                vendu,
                reste: p.stockDebut - vendu // reste = invendu boutique
              }
              : p
          ),
          updatedAt: new Date()
        }
      };
    });

    // Sauvegarde automatique avec debounce
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        console.log('💾 Sauvegarde automatique équipe soir...');
        await get().sauvegarderEquipe('soir');
      } catch (error) {
        console.error('❌ Erreur sauvegarde automatique soir:', error);
      }
    }, 2000); // Attendre 2 secondes après la dernière modification
  },

  terminerEquipeMatin: () => {
    set((state) => ({
      equipeMatin: state.equipeMatin ? {
        ...state.equipeMatin,
        statut: 'termine' as const,
        updatedAt: new Date()
      } : null
    }));
  },

  terminerEquipeSoir: () => {
    set((state) => ({
      equipeSoir: state.equipeSoir ? {
        ...state.equipeSoir,
        statut: 'termine' as const,
        updatedAt: new Date()
      } : null
    }));

    // Calculer automatiquement les ventes de la journée
    get().calculerVentesBoutique();
  },

  // Actions Calculs
  calculerVentesBoutique: () => {
    const { stockJour, equipeMatin, equipeSoir } = get();

    if (!stockJour || !equipeMatin || !equipeSoir) return;

    const ventesJour: VentesBoutique = {
      id: `ventes_${stockJour.date.getTime()}`,
      date: stockJour.date,
      produits: stockJour.produits.map(stockProduit => {
        const produitMatin = equipeMatin.produits.find(p => p.produitId === stockProduit.produitId);
        const produitSoir = equipeSoir.produits.find(p => p.produitId === stockProduit.produitId);

        const venduMatin = produitMatin?.vendu || 0;
        const resteMidi = produitMatin?.reste || 0;
        const venduSoir = produitSoir?.vendu || 0;
        const invenduBoutique = produitSoir?.reste || 0;

        return {
          produitId: stockProduit.produitId,
          produit: stockProduit.produit,
          stockDebut: stockProduit.stockDebut,
          venduMatin,
          resteMidi,
          venduSoir,
          invenduBoutique,
          venduTotal: venduMatin + venduSoir
        };
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ ventesJour });
  },

  calculerResteMidi: (produitId: string) => {
    const { equipeMatin } = get();
    if (!equipeMatin) return 0;

    const produit = equipeMatin.produits.find(p => p.produitId === produitId);
    if (!produit) return 0;

    return produit.stockDebut - produit.vendu;
  },

  calculerInvenduBoutique: (produitId: string) => {
    const { equipeSoir } = get();
    if (!equipeSoir) return 0;

    const produit = equipeSoir.produits.find(p => p.produitId === produitId);
    if (!produit) return 0;

    return produit.reste;
  },

  // Actions Sauvegarde
  sauvegarderEquipe: async (periode: 'matin' | 'soir') => {
    const { equipeMatin, equipeSoir } = get();
    const equipe = periode === 'matin' ? equipeMatin : equipeSoir;

    if (!equipe) return;

    set({ isLoading: true });
    try {
      console.log(`🔄 Début sauvegarde équipe ${periode}:`, equipe);

      // Utiliser un ID prévisible pour éviter les requêtes complexes
      const dateStr = equipe.date.toISOString().split('T')[0];
      const docId = `${dateStr}_${periode}`;

      // Préparer les données pour Firebase
      const firestoreData = {
        ...equipe,
        date: equipe.date, // Firebase convertira automatiquement
        createdAt: equipe.createdAt,
        updatedAt: new Date()
      };

      console.log(`💾 Sauvegarde vers document ID: ${docId}`);

      // Utiliser setDoc() avec merge pour créer ou mettre à jour
      const docRef = doc(db, 'shopShifts', docId);
      await setDoc(docRef, firestoreData, { merge: true });
      console.log(`✅ Équipe ${periode} sauvegardée avec succès - ID: ${docId}`);

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error(`❌ Erreur lors de la sauvegarde de l'équipe ${periode}:`, error);
      throw error;
    }
  },

  sauvegarderVentes: async () => {
    const { ventesJour } = get();
    if (!ventesJour) return;

    set({ isLoading: true });
    try {
      console.log('🔄 Début sauvegarde ventes boutique:', ventesJour);

      // Utiliser un ID prévisible basé sur la date
      const dateStr = ventesJour.date.toISOString().split('T')[0];
      const docId = `ventes_${dateStr}`;

      // Préparer les données pour Firebase
      const firestoreData = {
        ...ventesJour,
        date: ventesJour.date,
        createdAt: ventesJour.createdAt,
        updatedAt: new Date()
      };

      console.log(`💾 Sauvegarde ventes vers document ID: ${docId}`);

      // Utiliser setDoc() avec merge pour créer ou mettre à jour
      const docRef = doc(db, 'shopSales', docId);
      await setDoc(docRef, firestoreData, { merge: true });
      console.log(`✅ Ventes boutique sauvegardées avec succès - ID: ${docId}`);

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors de la sauvegarde des ventes:', error);
      throw error;
    }
  },

  // Actions Chargement
  chargerEquipe: async (date: Date, periode: 'matin' | 'soir') => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const docId = `${dateStr}_${periode}`;

      console.log(`🔄 Chargement équipe ${periode} pour ${dateStr}...`);

      const docRef = doc(db, 'shopShifts', docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const equipe: EquipeBoutique = {
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as EquipeBoutique;

        if (periode === 'matin') {
          set({ equipeMatin: equipe });
        } else {
          set({ equipeSoir: equipe });
        }

        console.log(`✅ Équipe ${periode} chargée depuis Firebase`);
      } else {
        console.log(`ℹ️ Aucune équipe ${periode} trouvée pour cette date`);
        if (periode === 'matin') {
          set({ equipeMatin: null });
        } else {
          set({ equipeSoir: null });
        }
      }
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de l'équipe ${periode}:`, error);
    }
  },

  chargerVentes: async (date: Date) => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const docId = `ventes_${dateStr}`;

      console.log(`🔄 Chargement ventes pour ${dateStr}...`);

      const docRef = doc(db, 'shopSales', docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const ventes: VentesBoutique = {
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as VentesBoutique;

        set({ ventesJour: ventes });
        console.log(`✅ Ventes chargées depuis Firebase`);
      } else {
        console.log(`ℹ️ Aucunes ventes trouvées pour cette date`);
        set({ ventesJour: null });
      }
    } catch (error) {
      console.error(`❌ Erreur lors du chargement des ventes:`, error);
    }
  },

  // Setters
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));