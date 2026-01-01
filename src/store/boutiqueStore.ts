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
  ajouterProduitManuel: (date: Date, produitId: string, quantite: number, vendu?: number, periode?: 'matin' | 'soir' | null) => Promise<void>;
  modifierQuantiteStock: (date: Date, produitId: string, nouvelleQuantite: number) => Promise<void>;
  supprimerProduitStock: (date: Date, produitId: string) => Promise<void>;
  chargerProduits: () => Promise<void>;

  // Actions Équipes
  commencerEquipeMatin: (vendeuse: string, date: Date) => void;
  commencerEquipeSoir: (vendeuse: string, date: Date) => void;
  saisirVenteMatin: (produitId: string, vendu: number) => void;
  saisirVenteSoir: (produitId: string, vendu: number) => void;
  terminerEquipeMatin: () => void;
  terminerEquipeSoir: () => void;
  rouvrirEquipeMatin: () => void;
  rouvrirEquipeSoir: () => void;

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
  getVentesPeriode: (dateDebut: Date, dateFin: Date) => Promise<number>;


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

  ajouterProduitManuel: async (date: Date, produitId: string, quantite: number, vendu: number = 0, periode: 'matin' | 'soir' | null = null) => {
    set({ isLoading: true });
    try {
      const { stockJour, produits } = get();
      const produit = produits.find(p => p.id === produitId);

      if (!produit) {
        throw new Error('Produit introuvable');
      }

      // 1. Mettre à jour le stock du jour
      let n_stockJour = stockJour;

      if (!n_stockJour) {
        // Créer un nouveau stock si inexistant
        n_stockJour = {
          id: `stock_${date.getTime()}`,
          date,
          produits: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Ajouter ou mettre à jour le produit dans le stock
      const existingProductIndex = n_stockJour.produits.findIndex(p => p.produitId === produitId);
      const newStockProducts = [...n_stockJour.produits];

      if (existingProductIndex >= 0) {
        newStockProducts[existingProductIndex] = {
          ...newStockProducts[existingProductIndex],
          stockDebut: newStockProducts[existingProductIndex].stockDebut + quantite
        };
      } else {
        newStockProducts.push({
          produitId,
          produit,
          stockDebut: quantite,
          repartitionCars: { car1_matin: 0, car2_matin: 0, car_soir: 0 } // Stock manuel
        });
      }

      const updatedStock: StockBoutique = {
        ...n_stockJour,
        produits: newStockProducts,
        updatedAt: new Date()
      };

      // Sauvegarder le stock
      set({ stockJour: updatedStock });

      // Sauvegarder le stock
      if (stockJour) {
        await setDoc(doc(db, 'shopStock', stockJour.id), {
          ...updatedStock,
          date: date, // important pour Firestore
          produits: updatedStock.produits.map(p => ({
            ...p,
            produit: p.produit ? { ...p.produit } : null // Nettoyer l'objet produit
          }))
        }, { merge: true });
      } else {
        // Utiliser le même ID que celui généré localement pour éviter les doublons/incohérences
        await setDoc(doc(db, 'shopStock', updatedStock.id), {
          ...updatedStock,
          date: date,
          produits: updatedStock.produits.map(p => ({
            ...p,
            produit: p.produit ? { ...p.produit } : null
          }))
        });
      }

      // 2. Propager aux équipes actives
      const currentEquipeMatin = get().equipeMatin;
      const currentEquipeSoir = get().equipeSoir;

      // Mise à jour Équipe Matin (si elle existe)
      if (currentEquipeMatin) {
        const newMatinProducts = [...currentEquipeMatin.produits];
        const pIndex = newMatinProducts.findIndex(p => p.produitId === produitId);

        if (pIndex >= 0) {
          newMatinProducts[pIndex] = {
            ...newMatinProducts[pIndex],
            stockDebut: newMatinProducts[pIndex].stockDebut + quantite,
            vendu: periode === 'matin' ? (newMatinProducts[pIndex].vendu + (vendu || 0)) : newMatinProducts[pIndex].vendu,
            reste: newMatinProducts[pIndex].reste + quantite - (periode === 'matin' ? (vendu || 0) : 0)
          };
        } else {
          newMatinProducts.push({
            produitId,
            produit: produit ? { ...produit } : undefined,
            stockDebut: quantite,
            vendu: periode === 'matin' ? (vendu || 0) : 0,
            reste: quantite - (periode === 'matin' ? (vendu || 0) : 0)
          });
        }

        const updatedMatin = {
          ...currentEquipeMatin,
          produits: newMatinProducts,
          updatedAt: new Date()
        };
        console.log('Mise à jour équipe matin:', updatedMatin);
        set({ equipeMatin: updatedMatin });
        await get().sauvegarderEquipe('matin');
      }

      // Mise à jour Équipe Soir (si elle existe)
      if (currentEquipeSoir) {
        const newSoirProducts = [...currentEquipeSoir.produits];
        const pIndex = newSoirProducts.findIndex(p => p.produitId === produitId);

        // La quantité qui arrive au soir dépend de si elle a été vendue le matin
        const quantityAddedToSoir = quantite - (periode === 'matin' ? (vendu || 0) : 0);

        // Si soldé en soirée, on déduit du reste du soir
        const venduSoir = periode === 'soir' ? (vendu || 0) : 0;

        if (pIndex >= 0) {
          newSoirProducts[pIndex] = {
            ...newSoirProducts[pIndex],
            stockDebut: newSoirProducts[pIndex].stockDebut + quantityAddedToSoir,
            vendu: newSoirProducts[pIndex].vendu + venduSoir,
            reste: newSoirProducts[pIndex].reste + quantityAddedToSoir - venduSoir
          };
        } else {
          newSoirProducts.push({
            produitId,
            produit: produit ? { ...produit } : undefined,
            stockDebut: quantityAddedToSoir,
            vendu: venduSoir,
            reste: quantityAddedToSoir - venduSoir
          });
        }

        const updatedSoir = {
          ...currentEquipeSoir,
          produits: newSoirProducts,
          updatedAt: new Date()
        };
        console.log('Mise à jour équipe soir:', updatedSoir);
        set({ equipeSoir: updatedSoir });
        await get().sauvegarderEquipe('soir');
      }

      // 3. Recalculer les ventes globale
      get().calculerVentesBoutique();
      await get().sauvegarderVentes();

      set({ isLoading: false });
      console.log(`✅ Stock manuel ajouté: ${quantite} x ${produit.nom}`);

    } catch (error) {
      console.error('Erreur ajout stock manuel:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  modifierQuantiteStock: async (date: Date, produitId: string, nouvelleQuantite: number) => {
    set({ isLoading: true });
    try {
      const { stockJour, equipeMatin, equipeSoir } = get();

      if (!stockJour) return;

      // 1. Calculer la différence
      const currentProduct = stockJour.produits.find(p => p.produitId === produitId);
      if (!currentProduct) {
        throw new Error("Produit non trouvé dans le stock du jour");
      }
      const ancienStock = currentProduct.stockDebut;
      const difference = nouvelleQuantite - ancienStock;

      if (difference === 0) {
        set({ isLoading: false });
        return;
      }

      // 2. Mettre à jour stockJour
      const newStockProducts = stockJour.produits.map(p =>
        p.produitId === produitId ? { ...p, stockDebut: nouvelleQuantite } : p
      );

      const updatedStock = {
        ...stockJour,
        produits: newStockProducts,
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'shopStock', stockJour.id), {
        ...updatedStock,
        date: date,
        produits: updatedStock.produits.map(p => ({
          ...p,
          produit: p.produit ? { ...p.produit } : null
        }))
      }, { merge: true });

      set({ stockJour: updatedStock });

      // 3. Propager la différence aux équipes actives

      // Équipe Matin
      if (equipeMatin && (equipeMatin.statut === 'en_cours' || equipeMatin.statut === 'termine')) {
        const newMatinProducts = [...equipeMatin.produits];
        const pIndex = newMatinProducts.findIndex(p => p.produitId === produitId);

        if (pIndex >= 0) {
          // On ajuste le stock de début
          newMatinProducts[pIndex] = {
            ...newMatinProducts[pIndex],
            stockDebut: newMatinProducts[pIndex].stockDebut + difference,
            reste: newMatinProducts[pIndex].reste + difference
          };

          const updatedMatin = {
            ...equipeMatin,
            produits: newMatinProducts,
            updatedAt: new Date()
          };

          set({ equipeMatin: updatedMatin });
          await get().sauvegarderEquipe('matin');
        }
      }

      // Équipe Soir
      if (equipeSoir && (equipeSoir.statut === 'en_cours' || equipeSoir.statut === 'termine')) {
        const newSoirProducts = [...equipeSoir.produits];
        const pIndex = newSoirProducts.findIndex(p => p.produitId === produitId);

        if (pIndex >= 0) {
          // On ajuste le stock de début du soir aussi (car il dépend souvent du reste matin ou stock global)
          // Note: Si le soir est initialisé, son stockDebut est censé être fixe, mais si on corrige le stock "source",
          // il est logique que la correction se propage.
          newSoirProducts[pIndex] = {
            ...newSoirProducts[pIndex],
            stockDebut: newSoirProducts[pIndex].stockDebut + difference,
            reste: newSoirProducts[pIndex].reste + difference
          };

          const updatedSoir = {
            ...equipeSoir,
            produits: newSoirProducts,
            updatedAt: new Date()
          };

          set({ equipeSoir: updatedSoir });
          await get().sauvegarderEquipe('soir');
        } else if (equipeMatin?.statut === 'termine') {
          // Si le produit n'était pas là, c'est peut-être qu'il a été ajouté manuellement hors flux
          // Mais modifierQuantite suppose qu'il existe déjà dans stockJour.
          // Si on modifie une quantité existante, on suppose qu'il devrait être là.
        }
      }

      // 4. Recalculer les ventes
      get().calculerVentesBoutique();
      await get().sauvegarderVentes();

      set({ isLoading: false });
      console.log(`✅ Stock ajusté: ${produitId} de ${ancienStock} à ${nouvelleQuantite} (Diff: ${difference})`);

    } catch (error) {
      console.error('Erreur ajustement stock:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  supprimerProduitStock: async (date: Date, produitId: string) => {
    set({ isLoading: true });
    try {
      const { stockJour, equipeMatin, equipeSoir } = get();

      if (!stockJour) return;

      // 1. Mettre à jour stockJour
      const newStockProducts = stockJour.produits.filter(p => p.produitId !== produitId);

      const updatedStock = {
        ...stockJour,
        produits: newStockProducts,
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'shopStock', stockJour.id), {
        ...updatedStock,
        date: date,
        produits: updatedStock.produits.map(p => ({
          ...p,
          produit: p.produit ? { ...p.produit } : null
        }))
      }, { merge: true });

      set({ stockJour: updatedStock });


      // 2. Propager la suppression aux équipes actives

      // Mise à jour Équipe Matin (si elle existe)
      if (equipeMatin) {
        const newMatinProducts = equipeMatin.produits.filter(p => p.produitId !== produitId);

        const updatedMatin = {
          ...equipeMatin,
          produits: newMatinProducts,
          updatedAt: new Date()
        };

        set({ equipeMatin: updatedMatin });
        await get().sauvegarderEquipe('matin');
      }

      // Mise à jour Équipe Soir (si elle existe)
      if (equipeSoir) {
        const newSoirProducts = equipeSoir.produits.filter(p => p.produitId !== produitId);

        const updatedSoir = {
          ...equipeSoir,
          produits: newSoirProducts,
          updatedAt: new Date()
        };

        set({ equipeSoir: updatedSoir });
        await get().sauvegarderEquipe('soir');
      }

      // 3. Recalculer les ventes
      get().calculerVentesBoutique();
      await get().sauvegarderVentes();

      set({ isLoading: false });
      console.log(`✅ Produit supprimé du stock: ${produitId}`);

    } catch (error) {
      console.error('Erreur suppression produit stock:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  chargerProduits: async () => {
    try {
      const q = query(collection(db, 'produits'));
      const snapshot = await getDocs(q);
      const produits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produit));
      set({ produits });
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    }
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
    const { equipeMatin, stockJour } = get();
    if (!equipeMatin || !stockJour) return;

    const nouvelleEquipe: EquipeBoutique = {
      id: `equipe_soir_${date.getTime()}`,
      date,
      periode: 'soir',
      vendeuse,
      produits: stockJour.produits.map(stockProd => {
        // Trouver le produit correspondant dans l'équipe du matin
        const prodMatin = equipeMatin.produits.find(p => p.produitId === stockProd.produitId);

        // Vendu du matin (0 si le produit n'était pas là le matin)
        const venduMatin = prodMatin?.vendu || 0;

        // Le stock de départ du soir = Stock Total Jour - Vendu Matin
        // Cela inclut automatiquement les ajouts manuels faits dans stockJour
        const stockPourSoir = stockProd.stockDebut - venduMatin;

        return {
          produitId: stockProd.produitId,
          stockDebut: stockPourSoir,
          vendu: 0,
          reste: stockPourSoir,
          produit: stockProd.produit
        };
      }).filter(p => p.stockDebut > 0), // On ne garde que ce qui a du stock
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

  rouvrirEquipeMatin: () => {
    set((state) => ({
      equipeMatin: state.equipeMatin ? {
        ...state.equipeMatin,
        statut: 'en_cours' as const,
        updatedAt: new Date()
      } : null
    }));
  },

  rouvrirEquipeSoir: () => {
    set((state) => ({
      equipeSoir: state.equipeSoir ? {
        ...state.equipeSoir,
        statut: 'en_cours' as const,
        updatedAt: new Date()
      } : null
    }));
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

  getVentesPeriode: async (dateDebut: Date, dateFin: Date) => {
    try {
      if (!dateDebut || !dateFin) return 0;

      const q = query(
        collection(db, 'shopSales'),
        where('date', '>=', dateToTimestamp(dateDebut)),
        where('date', '<=', dateToTimestamp(dateFin))
      );

      const snapshot = await getDocs(q);

      // Somme des ventes totales (venduTotal * prixBoutique ?) 
      // Attention: VentesBoutique contient 'produits' avec 'venduTotal'. 
      // Mais on n'a pas le prix stocké dans VentesBoutique.produits (si, on a juste produitId, stockDebut, etc. et une copie de produit?).
      // Regardons 'creerStockJour' -> 'produits.map... produit: p.produit'.
      // Donc oui, l'objet 'produit' complet est stocké dans 'ventesJour.produits[].produit'.

      let totalPeriode = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data() as VentesBoutique;
        const totalJour = data.produits.reduce((acc, p) => {
          const prix = p.produit?.prixBoutique || p.produit?.prixUnitaire || 0;
          return acc + (p.venduTotal * prix);
        }, 0);
        totalPeriode += totalJour;
      });

      return totalPeriode;
    } catch (error) {
      console.error('Erreur calcul CA boutique période:', error);
      return 0;
    }
  },

  // Setters
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));