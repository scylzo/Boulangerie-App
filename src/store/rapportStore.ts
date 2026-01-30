import { create } from 'zustand';
import { collection, doc, setDoc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { RapportJournalier, IndicateursPerformance } from '../types';
import { useProductionStore } from './productionStore';
import { useBoutiqueStore } from './boutiqueStore';
import { useLivraisonStore } from './livraisonStore';
import { useReferentielStore } from './referentielStore';

interface RapportStore {
  // État
  rapportJour: RapportJournalier | null;
  historiqueRapports: RapportJournalier[];
  indicateurs: IndicateursPerformance | null;
  isLoading: boolean;

  // Actions Rapport
  genererRapportJour: (date: Date) => Promise<void>;
  chargerRapport: (date: Date) => Promise<void>;
  validerRapport: () => Promise<void>;

  // Actions Historique
  chargerHistorique: (dateDebut: Date, dateFin: Date) => Promise<void>;

  // Actions Calculs
  calculerIndicateursPerformance: (date: Date) => void;
  calculerTauxVente: (vendu: number, stock: number) => number;
  calculerEcart: (valeur1: number, valeur2: number) => number;

  // Setters
  setLoading: (loading: boolean) => void;
}

export const useRapportStore = create<RapportStore>((set, get) => ({
  // État initial
  rapportJour: null,
  historiqueRapports: [],
  indicateurs: null,
  isLoading: false,

  // Actions Rapport
  genererRapportJour: async (date: Date) => {
    set({ isLoading: true });

    try {
      console.log('🔄 Génération rapport pour:', date.toISOString().split('T')[0]);

      // Récupérer toutes les données nécessaires
      const productionStore = useProductionStore.getState();
      const boutiqueStore = useBoutiqueStore.getState();
      const livraisonStore = useLivraisonStore.getState();
      const referentielStore = useReferentielStore.getState();

      console.log('📦 Chargement des données depuis les stores...');

      // Test direct Firebase pour déboguer
      try {
        console.log('🔍 Test direct Firebase...');
        const testQuery = query(
          collection(db, 'productionPrograms'),
          where('date', '>=', new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z')),
          where('date', '<=', new Date(date.toISOString().split('T')[0] + 'T23:59:59.999Z'))
        );
        const testSnapshot = await getDocs(testQuery);
        console.log('📊 Documents trouvés dans productionPrograms:', testSnapshot.docs.length);
        testSnapshot.docs.forEach((doc, index) => {
          console.log(`📄 Document ${index + 1}:`, doc.id, doc.data());
        });
      } catch (testError) {
        console.error('❌ Erreur test Firebase:', testError);
      }

      // 1. Charger le programme de production
      console.log('🏗️ Chargement programme production...');
      console.log('📅 Date recherchée:', date, date.toISOString().split('T')[0]);
      await productionStore.chargerProgramme(date);
      console.log('✅ Programme production chargé');

      // Vérifier immédiatement après chargement
      const programmeApresChargement = useProductionStore.getState().programmeActuel;
      console.log('🔍 Programme après chargement:', programmeApresChargement);

      // 2. Charger les ventes boutique
      console.log('🏪 Chargement ventes boutique...');
      await boutiqueStore.chargerVentes(date);
      console.log('✅ Ventes boutique chargées');

      // 2b. Charger le stock boutique du jour (pour les produits ajoutés manuellement)
      console.log('🏪 Chargement stock boutique...');
      await boutiqueStore.chargerStockJour(date);
      console.log('✅ Stock boutique chargé');

      // 3. Charger les retours clients
      console.log('📦 Chargement retours clients...');
      await livraisonStore.chargerInvendusDuJour(date);
      console.log('✅ Retours clients chargés');

      // 4. Charger les données de référence si nécessaire
      console.log('📚 Chargement données de référence...');
      if (referentielStore.produits.length === 0) {
        await referentielStore.chargerProduits();
      }
      console.log('✅ Données de référence chargées');

      // Obtenir les données fraîches après chargement
      const productionState = useProductionStore.getState();
      const boutiqueState = useBoutiqueStore.getState();
      const livraisonState = useLivraisonStore.getState();
      const referentielState = useReferentielStore.getState();

      const programme = productionState.programmeActuel;
      const ventesJour = boutiqueState.ventesJour;
      const stockJour = boutiqueState.stockJour;
      const invendusClients = livraisonState.invendusClients;
      const commandesClients = programme?.commandesClients || productionState.commandesClients;
      const produits = referentielState.produits;

      console.log('🔍 Debug - Données récupérées:', {
        'programme': programme,
        'ventesJour': ventesJour,
        'stockJour': stockJour,
        'invendusClients': invendusClients,
        'commandesClients': commandesClients,
        'produits': produits,
        'productionState': productionState
      });

      // Debug approfondi du programme
      if (programme) {
        console.log('📋 Structure détaillée du programme:', {
          'programme.id': programme.id,
          'programme.dateProduction': programme.dateProduction,
          'programme keys': Object.keys(programme),
          'programme complet': JSON.stringify(programme, null, 2)
        });
      }

      if (!programme || !programme.totauxParProduit || programme.totauxParProduit.length === 0) {
        console.warn('⚠️ Aucun programme de production trouvé pour cette date. Recherche d\'autres données (boutique, clients)...');
      }

      console.log('📊 Données chargées:', {
        programme: !!programme,
        'programme.totauxParProduit': programme?.totauxParProduit,
        ventesJour: !!ventesJour,
        invendusClients: invendusClients.length,
        commandesClients: commandesClients.length,
        'commandesClients détail': commandesClients
      });

      // 1. Collecter tous les IDs de produits uniques de toutes les sources
      const allProduitIds = new Set<string>();

      if (programme?.totauxParProduit) {
        programme.totauxParProduit.forEach(p => allProduitIds.add(p.produitId));
      }

      if (ventesJour?.produits) {
        ventesJour.produits.forEach(p => allProduitIds.add(p.produitId));
      }

      if (stockJour?.produits) {
        stockJour.produits.forEach(p => allProduitIds.add(p.produitId));
      }

      if (invendusClients) {
        invendusClients.forEach(inv => inv.produits.forEach(p => allProduitIds.add(p.produitId)));
      }

      if (commandesClients) {
        commandesClients.forEach(cmd => cmd.produits.forEach(p => allProduitIds.add(p.produitId)));
      }

      console.log('📋 Liste exhaustive des produits identifiés:', Array.from(allProduitIds));

      // Calculer le rapport pour chaque produit identifié
      const rapportProduits = Array.from(allProduitIds).map(produitId => {
        const produit = produits.find(p => p.id === produitId);

        // Données du programme
        const progProduit = programme?.totauxParProduit?.find(p => p.produitId === produitId);

        // Quantités prévues et boutique
        const quantitePrevue = progProduit?.totalGlobal || 0;
        const quantiteBoutique = progProduit?.totalBoutique || 0;

        // Quantités livrées aux clients
        const quantiteLivreeClients = commandesClients
          .flatMap(cmd => cmd.produits)
          .filter(p => p.produitId === produitId)
          .reduce((sum, p) => {
            const total = Object.values(p.repartitionCars || {})
              .reduce((carSum, qte) => carSum + (Number(qte) || 0), 0);
            return sum + total;
          }, 0);

        // Ventes boutique
        const venteBoutiqueProduit = ventesJour?.produits.find(v => v.produitId === produitId);
        const venduBoutique = venteBoutiqueProduit?.venduTotal || 0;
        const invenduBoutique = venteBoutiqueProduit?.invenduBoutique || 0;
        const stockDebutBoutique = venteBoutiqueProduit?.stockDebut || quantiteBoutique;

        // Invendus clients (retours)
        const invendusClientsProduit = invendusClients
          .flatMap(inv => inv.produits)
          .filter(p => p.produitId === produitId)
          .reduce((sum, p) => sum + p.invendus, 0);

        // Ventes clients = Livré - Invendus
        const venduClients = Math.max(0, quantiteLivreeClients - invendusClientsProduit);

        // Calculs totaux
        // Utiliser la quantité réelle si saisie dans le programme, sinon l'estimation
        const quantiteProduite = progProduit?.quantiteProduiteReelle ?? (quantiteLivreeClients + stockDebutBoutique);
        const quantiteVendueTotal = venduClients + venduBoutique;
        const invendusTotal = invendusClientsProduit + invenduBoutique;

        // Taux de vente
        const calculerTaux = (vendu: number, stock: number) => {
          return stock > 0 ? Math.round((vendu / stock) * 10000) / 100 : 0;
        };

        const tauxVenteClients = calculerTaux(venduClients, quantiteLivreeClients);
        const tauxVenteBoutique = calculerTaux(venduBoutique, stockDebutBoutique);
        const tauxVenteGlobal = calculerTaux(quantiteVendueTotal, quantiteProduite);

        // Valeurs monétaires
        const prixBoutique = produit?.prixBoutique || produit?.prixUnitaire || 0;
        const prixClient = produit?.prixClient || produit?.prixUnitaire || 0;
        const valeurVenteBoutique = venduBoutique * prixBoutique;
        const valeurVenteClients = venduClients * prixClient;
        const valeurVenteTotal = valeurVenteBoutique + valeurVenteClients;

        // Flag de destination
        const destineClients = (progProduit?.totalClient || 0) > 0 || quantiteLivreeClients > 0 || (commandesClients?.some(cmd => cmd.produits.some(p => p.produitId === produitId)) ?? false);
        const destineBoutique = (progProduit?.totalBoutique || 0) > 0 || stockDebutBoutique > 0 || (ventesJour?.produits.some(v => v.produitId === produitId) ?? false);

        return {
          produitId: produitId,
          produit: produit,
          destineClients,
          destineBoutique,
          quantitePrevue,
          quantiteProduite,
          quantiteVendueClients: venduClients,
          quantiteVendueBoutique: venduBoutique,
          quantiteVendueTotal,
          invendusClients: invendusClientsProduit,
          invendusBoutique: invenduBoutique,
          invendusTotal,
          valeurVenteClients,
          valeurVenteBoutique,
          valeurVenteTotal,
          tauxVenteClients,
          tauxVenteBoutique,
          tauxVenteGlobal,
          ecartPrevuProduit: quantiteProduite - quantitePrevue,
          ecartProduitVendu: quantiteProduite - quantiteVendueTotal
        };
      });

      // Calculer les totaux
      const totaux = rapportProduits.reduce((acc, produit) => ({
        quantitePrevue: acc.quantitePrevue + produit.quantitePrevue,
        quantiteProduite: acc.quantiteProduite + produit.quantiteProduite,
        quantiteVendueTotal: acc.quantiteVendueTotal + produit.quantiteVendueTotal,
        invendusTotal: acc.invendusTotal + produit.invendusTotal,
        tauxVenteGlobal: 0, // Calculé après
        pertesTotales: acc.pertesTotales + produit.invendusTotal,
        valeurVenteClients: acc.valeurVenteClients + produit.valeurVenteClients,
        valeurVenteBoutique: acc.valeurVenteBoutique + produit.valeurVenteBoutique,
        valeurVenteTotal: acc.valeurVenteTotal + produit.valeurVenteTotal
      }), {
        quantitePrevue: 0,
        quantiteProduite: 0,
        quantiteVendueTotal: 0,
        invendusTotal: 0,
        tauxVenteGlobal: 0,
        pertesTotales: 0,
        valeurVenteClients: 0,
        valeurVenteBoutique: 0,
        valeurVenteTotal: 0
      });

      // Calculer le taux de vente global
      totaux.tauxVenteGlobal = totaux.quantiteProduite > 0
        ? Math.round((totaux.quantiteVendueTotal / totaux.quantiteProduite) * 10000) / 100
        : 0;

      const rapportJournalier: RapportJournalier = {
        id: `rapport_${date.getTime()}`,
        date,
        produits: rapportProduits,
        totaux,
        statut: 'genere',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      set({
        rapportJour: rapportJournalier,
        isLoading: false
      });

      // Calculer les indicateurs
      get().calculerIndicateursPerformance(date);

      console.log('✅ Rapport généré avec succès:', rapportJournalier);

      // Sauvegarder automatiquement le rapport généré en Firebase
      console.log('💾 Sauvegarde automatique du rapport en Firebase...');
      try {
        const dateStr = date.toISOString().split('T')[0];
        const docId = `rapport_${dateStr}`;
        const docRef = doc(db, 'dailyReports', docId);
        await setDoc(docRef, rapportJournalier, { merge: true });
        console.log('✅ Rapport sauvegardé automatiquement en Firebase');
      } catch (saveError) {
        console.error('❌ Erreur lors de la sauvegarde automatique:', saveError);
        // Ne pas arrêter le processus si la sauvegarde échoue
      }

    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors de la génération du rapport:', error);
      throw error;
    }
  },

  chargerRapport: async (date: Date) => {
    set({ isLoading: true });
    try {
      const dateStr = date.toISOString().split('T')[0];
      console.log(`🔄 Chargement rapport pour ${dateStr}...`);

      // ID prévisible basé sur la date
      const docId = `rapport_${dateStr}`;
      const docRef = doc(db, 'dailyReports', docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const rapport: RapportJournalier = {
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as RapportJournalier;

        set({ rapportJour: rapport });
        console.log(`✅ Rapport chargé depuis Firebase`);

        // Calculer les indicateurs
        get().calculerIndicateursPerformance(date);
      } else {
        console.log(`ℹ️ Aucun rapport trouvé pour cette date`);
        set({ rapportJour: null, indicateurs: null });
      }

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error(`❌ Erreur lors du chargement du rapport:`, error);
    }
  },

  validerRapport: async () => {
    const { rapportJour } = get();
    if (!rapportJour) return;

    try {
      const rapportValide = {
        ...rapportJour,
        statut: 'valide' as const,
        updatedAt: new Date()
      };

      // Sauvegarder vers Firestore avec un ID prévisible
      const dateStr = rapportValide.date.toISOString().split('T')[0];
      const docId = `rapport_${dateStr}`;

      console.log(`💾 Sauvegarde du rapport validé vers document ID: ${docId}`);

      const docRef = doc(db, 'dailyReports', docId);
      await setDoc(docRef, rapportValide, { merge: true });

      set({ rapportJour: rapportValide });
      console.log('✅ Rapport validé et sauvegardé avec succès');

    } catch (error) {
      console.error('❌ Erreur lors de la validation du rapport:', error);
      throw error;
    }
  },

  // Actions Historique
  chargerHistorique: async (dateDebut: Date, dateFin: Date) => {
    set({ isLoading: true });
    try {
      console.log(`🔄 Chargement de l'historique du ${dateDebut.toISOString().split('T')[0]} au ${dateFin.toISOString().split('T')[0]}`);

      // Requête pour charger tous les rapports dans la période
      const reportsQuery = query(
        collection(db, 'dailyReports'),
        where('date', '>=', dateDebut),
        where('date', '<=', dateFin)
      );

      const reportsSnapshot = await getDocs(reportsQuery);

      if (!reportsSnapshot.empty) {
        const rapportsHistorique = reportsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            date: data.date.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
          } as RapportJournalier;
        });

        // Trier par date décroissante (plus récent en premier)
        rapportsHistorique.sort((a, b) => b.date.getTime() - a.date.getTime());

        set({
          historiqueRapports: rapportsHistorique,
          isLoading: false
        });

        console.log(`✅ ${rapportsHistorique.length} rapport(s) chargé(s) depuis Firebase`);
      } else {
        console.log(`ℹ️ Aucun rapport trouvé pour cette période`);
        set({
          historiqueRapports: [],
          isLoading: false
        });
      }

    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors du chargement de l\'historique:', error);
      throw error;
    }
  },

  // Actions Calculs
  calculerIndicateursPerformance: (date: Date) => {
    const { rapportJour } = get();
    if (!rapportJour) return;

    const totauxClients = rapportJour.produits.reduce((acc, produit) => ({
      vendu: acc.vendu + produit.quantiteVendueClients,
      invendus: acc.invendus + produit.invendusClients
    }), { vendu: 0, invendus: 0 });

    const totauxBoutique = rapportJour.produits.reduce((acc, produit) => ({
      vendu: acc.vendu + produit.quantiteVendueBoutique,
      invendus: acc.invendus + produit.invendusBoutique
    }), { vendu: 0, invendus: 0 });

    const indicateurs: IndicateursPerformance = {
      date,
      tauxVenteClients: get().calculerTauxVente(
        totauxClients.vendu,
        totauxClients.vendu + totauxClients.invendus
      ),
      tauxVenteBoutique: get().calculerTauxVente(
        totauxBoutique.vendu,
        totauxBoutique.vendu + totauxBoutique.invendus
      ),
      tauxVenteGlobal: rapportJour.totaux.tauxVenteGlobal,
      pertesClients: totauxClients.invendus,
      pertesBoutique: totauxBoutique.invendus,
      pertesTotales: rapportJour.totaux.pertesTotales,
      valeurVenteClients: rapportJour.totaux.valeurVenteClients,
      valeurVenteBoutique: rapportJour.totaux.valeurVenteBoutique,
      valeurVenteTotal: rapportJour.totaux.valeurVenteTotal
    };

    set({ indicateurs });
  },

  calculerTauxVente: (vendu: number, stock: number) => {
    if (stock === 0) return 0;
    return Math.round((vendu / stock) * 100 * 100) / 100; // 2 décimales
  },

  calculerEcart: (valeur1: number, valeur2: number) => {
    return valeur1 - valeur2;
  },

  // Setters
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));