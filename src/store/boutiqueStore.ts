import { create } from 'zustand';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
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
  toggleModeJourneeContinue: () => Promise<void>;
  validerVenteDirecte: (date: Date, ventes: Record<string, number>) => Promise<void>;
  chargerProduits: () => Promise<void>;

  // Actions Équipes
  commencerEquipeMatin: (vendeuse: string, date: Date) => void;
  commencerEquipeSoir: (vendeuse: string, date: Date) => void;
  saisirVenteMatin: (produitId: string, vendu: number) => void;
  saisirVenteSoir: (produitId: string, vendu: number) => void;
  terminerEquipeMatin: () => void;
  terminerEquipeSoir: () => void;
  terminerEquipeSoirAvecRepartition: (repartition: Array<{ produitId: string; restants: number; pertes: number }>) => Promise<void>;
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
    const dateStr = date.toISOString().split('T')[0];
    const nouveauStock: StockBoutique = {
      id: `stock_${dateStr}`,
      date,
      produits: produits.map(p => ({
        produitId: p.produitId,
        stockDebut: p.stockDebut
      })),
      isJourneeContinue: date.getDay() === 0 || date.getDay() === 6,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ stockJour: nouveauStock });
  },

  chargerStockJour: async (date: Date) => {
    set({ isLoading: true });
    try {
      const dateStr = date.toISOString().split('T')[0];
      const docId = `stock_${dateStr}`;
      const docRef = doc(db, 'shopStock', docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const stockData = docSnap.data();
        const stock: StockBoutique = {
          ...stockData,
          date: stockData.date.toDate(),
          createdAt: stockData.createdAt.toDate(),
          updatedAt: stockData.updatedAt.toDate(),
        } as StockBoutique;

        set({ stockJour: stock });
        console.log('Stock boutique chargé (docId):', stock);
      } else {
        // Fallback: ancienne recherche par query (pour compatibilité)
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);

        const stockQuery = query(
          collection(db, 'shopStock'),
          where('date', '>=', dateToTimestamp(dateStart)),
          where('date', '<=', dateToTimestamp(dateEnd))
        );

        const stockSnapshot = await getDocs(stockQuery);
        if (!stockSnapshot.empty) {
          const stockData = stockSnapshot.docs[0].data();
          const stock: StockBoutique = {
            ...stockData,
            date: stockData.date.toDate(),
            createdAt: stockData.createdAt.toDate(),
            updatedAt: stockData.updatedAt.toDate(),
          } as StockBoutique;

          set({ stockJour: stock });
          console.log('Stock boutique chargé (query):', stock);
        } else {
          set({ stockJour: null });
        }
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
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const programmeQuery = query(
        collection(db, 'productionPrograms'),
        where('dateProduction', '>=', dateToTimestamp(dateStart)),
        where('dateProduction', '<=', dateToTimestamp(dateEnd))
      );

      const programmeSnapshot = await getDocs(programmeQuery);

      if (programmeSnapshot.empty) {
        set({ isLoading: false, stockJour: null });
        return;
      }

      const programmeData = programmeSnapshot.docs[0].data();
      const quantitesBoutique = programmeData.quantitesBoutique || [];

      if (quantitesBoutique.length === 0) {
        set({ isLoading: false, stockJour: null });
        return;
      }

      // Charger les produits pour avoir les noms
      const produitsSnapshot = await getDocs(collection(db, 'produits'));
      const produitsMap = new Map();
      produitsSnapshot.docs.forEach(doc => {
        produitsMap.set(doc.id, doc.data());
      });

      const stockProduits = quantitesBoutique.map((qte: any) => {
        const produit = produitsMap.get(qte.produitId);
        return {
          produitId: qte.produitId,
          stockDebut: qte.quantite,
          produit: produit || { nom: 'Produit inconnu' },
          repartitionCars: qte.repartitionCars || null
        };
      }).filter((p: any) => p.stockDebut > 0);

      const { stockJour: stockExistant } = get();

      if (forceUpdate || !stockExistant) {
        const dateStr = date.toISOString().split('T')[0];
        const docId = `stock_${dateStr}`;

        const nouveauStock: StockBoutique = {
          id: docId,
          date,
          produits: stockProduits,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await setDoc(doc(db, 'shopStock', docId), {
          ...nouveauStock,
          date: date,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        set({ stockJour: nouveauStock, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, stockJour: null });
      console.error('Erreur lors de la création du stock depuis production:', error);
    }
  },

  mettreAJourStockBoutique: async (date: Date) => {
    await get().creerStockDepuisProduction(date, true);
  },

  ajouterProduitManuel: async (date: Date, produitId: string, quantite: number, vendu: number = 0, periode: 'matin' | 'soir' | null = null) => {
    set({ isLoading: true });
    try {
      const { stockJour, produits } = get();
      const produit = produits.find(p => p.id === produitId);

      if (!produit) throw new Error('Produit introuvable');

      let n_stockJour = stockJour;
      const dateStr = date.toISOString().split('T')[0];
      const stockDocId = `stock_${dateStr}`;

      if (!n_stockJour) {
        n_stockJour = {
          id: stockDocId,
          date,
          produits: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

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
          repartitionCars: { car1_matin: 0, car2_matin: 0, car_soir: 0 }
        });
      }

      const updatedStock: StockBoutique = {
        ...n_stockJour,
        produits: newStockProducts,
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'shopStock', stockDocId), {
        ...updatedStock,
        date: date,
        produits: updatedStock.produits.map(p => ({
          ...p,
          produit: p.produit ? { ...p.produit } : null
        }))
      }, { merge: true });

      set({ stockJour: updatedStock });

      // Propager aux équipes actives
      const currentEquipeMatin = get().equipeMatin;
      const currentEquipeSoir = get().equipeSoir;

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
        set({ equipeMatin: { ...currentEquipeMatin, produits: newMatinProducts, updatedAt: new Date() } });
        await get().sauvegarderEquipe('matin');
      }

      if (currentEquipeSoir) {
        const newSoirProducts = [...currentEquipeSoir.produits];
        const pIndex = newSoirProducts.findIndex(p => p.produitId === produitId);
        const quantityAddedToSoir = quantite - (periode === 'matin' ? (vendu || 0) : 0);
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
        set({ equipeSoir: { ...currentEquipeSoir, produits: newSoirProducts, updatedAt: new Date() } });
        await get().sauvegarderEquipe('soir');
      }

      get().calculerVentesBoutique();
      await get().sauvegarderVentes();
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Erreur ajout stock manuel:', error);
      throw error;
    }
  },

  modifierQuantiteStock: async (date: Date, produitId: string, nouvelleQuantite: number) => {
    set({ isLoading: true });
    try {
      const { stockJour, equipeMatin, equipeSoir } = get();
      if (!stockJour) return;

      const currentProduct = stockJour.produits.find(p => p.produitId === produitId);
      if (!currentProduct) throw new Error("Produit non trouvé");

      const difference = nouvelleQuantite - currentProduct.stockDebut;
      if (difference === 0) {
        set({ isLoading: false });
        return;
      }

      const updatedProducts = stockJour.produits.map(p =>
        p.produitId === produitId ? { ...p, stockDebut: nouvelleQuantite } : p
      );

      const updatedStock = { ...stockJour, produits: updatedProducts, updatedAt: new Date() };
      await setDoc(doc(db, 'shopStock', stockJour.id), {
        ...updatedStock,
        date,
        produits: updatedStock.produits.map(p => ({ ...p, produit: p.produit ? { ...p.produit } : null }))
      }, { merge: true });

      set({ stockJour: updatedStock });

      if (equipeMatin) {
        const newMatinProds = equipeMatin.produits.map(p =>
          p.produitId === produitId ? { ...p, stockDebut: p.stockDebut + difference, reste: p.reste + difference } : p
        );
        set({ equipeMatin: { ...equipeMatin, produits: newMatinProds, updatedAt: new Date() } });
        await get().sauvegarderEquipe('matin');
      }

      if (equipeSoir) {
        const newSoirProds = equipeSoir.produits.map(p =>
          p.produitId === produitId ? { ...p, stockDebut: p.stockDebut + difference, reste: p.reste + difference } : p
        );
        set({ equipeSoir: { ...equipeSoir, produits: newSoirProds, updatedAt: new Date() } });
        await get().sauvegarderEquipe('soir');
      }

      get().calculerVentesBoutique();
      await get().sauvegarderVentes();
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Erreur modification stock:', error);
    }
  },

  supprimerProduitStock: async (date: Date, produitId: string) => {
    set({ isLoading: true });
    try {
      const { stockJour, equipeMatin, equipeSoir } = get();
      if (!stockJour) return;

      const updatedProducts = stockJour.produits.filter(p => p.produitId !== produitId);
      const updatedStock = { ...stockJour, produits: updatedProducts, updatedAt: new Date() };

      await setDoc(doc(db, 'shopStock', stockJour.id), {
        ...updatedStock,
        date,
        produits: updatedStock.produits.map(p => ({ ...p, produit: p.produit ? { ...p.produit } : null }))
      }, { merge: true });

      set({ stockJour: updatedStock });

      if (equipeMatin) {
        const newProds = equipeMatin.produits.filter(p => p.produitId !== produitId);
        set({ equipeMatin: { ...equipeMatin, produits: newProds, updatedAt: new Date() } });
        await get().sauvegarderEquipe('matin');
      }

      if (equipeSoir) {
        const newProds = equipeSoir.produits.filter(p => p.produitId !== produitId);
        set({ equipeSoir: { ...equipeSoir, produits: newProds, updatedAt: new Date() } });
        await get().sauvegarderEquipe('soir');
      }

      get().calculerVentesBoutique();
      await get().sauvegarderVentes();
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Erreur suppression produit:', error);
    }
  },

  toggleModeJourneeContinue: async () => {
    const { stockJour } = get();
    if (!stockJour) return;

    set({ isLoading: true });
    try {
      const nouveauMode = !stockJour.isJourneeContinue;
      const updatedStock = { ...stockJour, isJourneeContinue: nouveauMode, updatedAt: new Date() };

      await setDoc(doc(db, 'shopStock', stockJour.id), { isJourneeContinue: nouveauMode, updatedAt: new Date() }, { merge: true });

      set({ stockJour: updatedStock });
      get().calculerVentesBoutique();
      await get().sauvegarderVentes();
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Erreur toggle mode continue:', error);
    }
  },

  validerVenteDirecte: async (date: Date, ventes: Record<string, number>) => {
    set({ isLoading: true });
    try {
      const store = get();
      if (store.stockJour && !store.stockJour.isJourneeContinue) {
        await store.toggleModeJourneeContinue();
      }

      if (!get().equipeMatin) {
        get().commencerEquipeMatin("Vente Express", date);
      } else if (get().equipeMatin?.statut === 'termine') {
        get().rouvrirEquipeMatin();
      }

      Object.entries(ventes).forEach(([prodId, qte]) => {
        get().saisirVenteMatin(prodId, qte);
      });

      get().terminerEquipeMatin();
      await get().sauvegarderEquipe('matin');
      get().calculerVentesBoutique();
      await get().sauvegarderVentes();
      set({ isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      console.error("Erreur vente directe:", e);
    }
  },

  chargerProduits: async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'produits')));
      set({ produits: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produit)) });
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    }
  },

  commencerEquipeMatin: (vendeuse: string, date: Date) => {
    const { stockJour } = get();
    if (!stockJour) return;

    const nouvelleEquipe: EquipeBoutique = {
      id: `${date.toISOString().split('T')[0]}_matin`,
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
      id: `${date.toISOString().split('T')[0]}_soir`,
      date,
      periode: 'soir',
      vendeuse,
      produits: stockJour.produits.map(stockProd => {
        const prodMatin = equipeMatin.produits.find(p => p.produitId === stockProd.produitId);
        const stockPourSoir = stockProd.stockDebut - (prodMatin?.vendu || 0);
        return {
          produitId: stockProd.produitId,
          stockDebut: stockPourSoir,
          vendu: 0,
          reste: stockPourSoir,
          produit: stockProd.produit
        };
      }).filter(p => p.stockDebut > 0),
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
            p.produitId === produitId ? { ...p, vendu, reste: p.stockDebut - vendu } : p
          ),
          updatedAt: new Date()
        }
      };
    });

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try { await get().sauvegarderEquipe('matin'); } catch (e) { console.error(e); }
    }, 2000);
  },

  saisirVenteSoir: (produitId: string, vendu: number) => {
    set((state) => {
      if (!state.equipeSoir) return state;
      return {
        equipeSoir: {
          ...state.equipeSoir,
          produits: state.equipeSoir.produits.map(p =>
            p.produitId === produitId ? { ...p, vendu, reste: p.stockDebut - vendu } : p
          ),
          updatedAt: new Date()
        }
      };
    });

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try { await get().sauvegarderEquipe('soir'); } catch (e) { console.error(e); }
    }, 2000);
  },

  terminerEquipeMatin: () => {
    set((state) => ({
      equipeMatin: state.equipeMatin ? { ...state.equipeMatin, statut: 'termine', updatedAt: new Date() } : null
    }));
  },

  terminerEquipeSoir: () => {
    set((state) => ({
      equipeSoir: state.equipeSoir ? { ...state.equipeSoir, statut: 'termine', updatedAt: new Date() } : null
    }));
    get().calculerVentesBoutique();
  },

  terminerEquipeSoirAvecRepartition: async (repartition: Array<{ produitId: string; restants: number; pertes: number }>) => {
    try {
      // Terminer l'équipe soir
      set((state) => ({
        equipeSoir: state.equipeSoir ? { ...state.equipeSoir, statut: 'termine', updatedAt: new Date() } : null
      }));

      // Calculer les ventes
      get().calculerVentesBoutique();

      // Mettre à jour les ventes avec la répartition
      const { ventesJour } = get();
      if (ventesJour) {
        const produitsAvecRepartition = ventesJour.produits.map(p => {
          const rep = repartition.find(r => r.produitId === p.produitId);
          if (rep) {
            return {
              ...p,
              restants: rep.restants,
              pertes: rep.pertes
            };
          }
          return p;
        });

        set({
          ventesJour: {
            ...ventesJour,
            produits: produitsAvecRepartition,
            updatedAt: new Date()
          }
        });
      }

      // Sauvegarder
      await get().sauvegarderEquipe('soir');
      await get().sauvegarderVentes();

      // Créer le stock du lendemain avec les restants
      const { stockJour } = get();
      if (stockJour && repartition.some(r => r.restants > 0)) {
        const dateLendemain = new Date(stockJour.date);
        dateLendemain.setDate(dateLendemain.getDate() + 1);

        // Charger le stock du lendemain s'il existe
        await get().chargerStockJour(dateLendemain);
        const stockLendemain = get().stockJour;

        if (stockLendemain) {
          // Mettre à jour le stock existant avec les restants
          const produitsUpdates = stockLendemain.produits.map(p => {
            const rep = repartition.find(r => r.produitId === p.produitId);
            if (rep && rep.restants > 0) {
              return {
                ...p,
                stockReconduit: (p.stockReconduit || 0) + rep.restants
              };
            }
            return p;
          });

          // Ajouter les produits reconduits qui n'existent pas encore
          repartition.forEach(rep => {
            if (rep.restants > 0 && !produitsUpdates.find(p => p.produitId === rep.produitId)) {
              const produitInfo = stockJour.produits.find(p => p.produitId === rep.produitId);
              if (produitInfo) {
                produitsUpdates.push({
                  produitId: rep.produitId,
                  produit: produitInfo.produit,
                  stockDebut: 0,
                  stockReconduit: rep.restants
                });
              }
            }
          });

          const stockUpdated = {
            ...stockLendemain,
            produits: produitsUpdates,
            updatedAt: new Date()
          };

          await setDoc(doc(db, 'shopStock', stockLendemain.id), {
            ...stockUpdated,
            date: dateLendemain,
            produits: stockUpdated.produits.map(p => ({
              ...p,
              produit: p.produit ? { ...p.produit } : null
            }))
          }, { merge: true });
        }
      }
    } catch (error) {
      console.error('Erreur lors de la clôture avec répartition:', error);
      throw error;
    }
  },

  rouvrirEquipeMatin: () => {
    set((state) => ({
      equipeMatin: state.equipeMatin ? { ...state.equipeMatin, statut: 'en_cours', updatedAt: new Date() } : null
    }));
  },

  rouvrirEquipeSoir: () => {
    set((state) => ({
      equipeSoir: state.equipeSoir ? { ...state.equipeSoir, statut: 'en_cours', updatedAt: new Date() } : null
    }));
  },

  calculerVentesBoutique: () => {
    const { stockJour, equipeMatin, equipeSoir } = get();
    if (!stockJour || !equipeMatin) return;
    if (!stockJour.isJourneeContinue && !equipeSoir) return;

    // Collecter tous les IDs de produits uniques présents dans le stock OU les équipes
    const allProduitIds = new Set<string>();
    stockJour.produits.forEach(p => allProduitIds.add(p.produitId));
    equipeMatin.produits.forEach(p => allProduitIds.add(p.produitId));
    if (equipeSoir) equipeSoir.produits.forEach(p => allProduitIds.add(p.produitId));

    const dateStr = stockJour.date.toISOString().split('T')[0];
    const ventesJour: VentesBoutique = {
      id: `ventes_${dateStr}`,
      date: stockJour.date,
      produits: Array.from(allProduitIds).map(produitId => {
        const stockProduit = stockJour.produits.find(p => p.produitId === produitId);
        const pMatin = equipeMatin.produits.find(p => p.produitId === produitId);
        const pSoir = equipeSoir?.produits.find(p => p.produitId === produitId);

        const vMatin = pMatin?.vendu || 0;
        const rMidi = pMatin?.reste || 0;
        const vSoir = stockJour.isJourneeContinue ? 0 : (pSoir?.vendu || 0);
        const invendu = stockJour.isJourneeContinue ? rMidi : (pSoir?.reste || 0);

        // Récupérer les infos produit depuis n'importe quelle source disponible
        const infoProduit = stockProduit?.produit || pMatin?.produit || pSoir?.produit;

        return {
          produitId,
          produit: infoProduit,
          stockDebut: stockProduit?.stockDebut || pMatin?.stockDebut || 0,
          venduMatin: vMatin,
          resteMidi: rMidi,
          venduSoir: vSoir,
          invenduBoutique: invendu,
          restants: 0, // Sera mis à jour lors de la clôture avec répartition
          pertes: invendu, // Par défaut, tout est considéré comme perte
          venduTotal: vMatin + vSoir
        };
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({ ventesJour });
  },

  calculerResteMidi: (produitId: string) => {
    const p = get().equipeMatin?.produits.find(p => p.produitId === produitId);
    if (!p) return 0;
    return p.stockDebut - p.vendu;
  },

  calculerInvenduBoutique: (produitId: string) => {
    const p = get().equipeSoir?.produits.find(p => p.produitId === produitId);
    if (!p) return 0;
    return p.reste;
  },

  sauvegarderEquipe: async (periode: 'matin' | 'soir') => {
    const equipe = periode === 'matin' ? get().equipeMatin : get().equipeSoir;
    if (!equipe) return;
    set({ isLoading: true });
    try {
      const docId = `${equipe.date.toISOString().split('T')[0]}_${periode}`;
      await setDoc(doc(db, 'shopShifts', docId), { ...equipe, updatedAt: new Date() }, { merge: true });
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error(error);
    }
  },

  sauvegarderVentes: async () => {
    const { ventesJour } = get();
    if (!ventesJour) return;
    set({ isLoading: true });
    try {
      const docId = `ventes_${ventesJour.date.toISOString().split('T')[0]}`;
      await setDoc(doc(db, 'shopSales', docId), { ...ventesJour, updatedAt: new Date() }, { merge: true });
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error(error);
    }
  },

  chargerEquipe: async (date: Date, periode: 'matin' | 'soir') => {
    try {
      const docId = `${date.toISOString().split('T')[0]}_${periode}`;
      const docSnap = await getDoc(doc(db, 'shopShifts', docId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const equipe = { ...data, date: data.date.toDate(), createdAt: data.createdAt.toDate(), updatedAt: data.updatedAt.toDate() } as EquipeBoutique;
        if (periode === 'matin') set({ equipeMatin: equipe }); else set({ equipeSoir: equipe });
      } else {
        if (periode === 'matin') set({ equipeMatin: null }); else set({ equipeSoir: null });
      }
    } catch (e) { console.error(e); }
  },

  chargerVentes: async (date: Date) => {
    try {
      const docId = `ventes_${date.toISOString().split('T')[0]}`;
      const docSnap = await getDoc(doc(db, 'shopSales', docId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({ ventesJour: { ...data, date: data.date.toDate(), createdAt: data.createdAt.toDate(), updatedAt: data.updatedAt.toDate() } as VentesBoutique });
      } else {
        set({ ventesJour: null });
      }
    } catch (e) { console.error(e); }
  },

  getVentesPeriode: async (dateDebut: Date, dateFin: Date) => {
    try {
      const q = query(collection(db, 'shopSales'), where('date', '>=', dateToTimestamp(dateDebut)), where('date', '<=', dateToTimestamp(dateFin)));
      const snapshot = await getDocs(q);
      if (get().produits.length === 0) await get().chargerProduits();
      const catalogue = get().produits;
      let total = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data() as VentesBoutique;
        total += data.produits.reduce((acc, p) => {
          let prix = p.produit?.prixBoutique || p.produit?.prixUnitaire || 0;
          if (!prix) {
            const inCat = catalogue.find(cp => cp.id === p.produitId);
            prix = inCat?.prixBoutique || inCat?.prixUnitaire || 0;
          }
          return acc + (p.venduTotal * prix);
        }, 0);
      });
      return total;
    } catch (e) { console.error(e); return 0; }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));