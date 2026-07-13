import { create } from 'zustand';

import type { ProgrammeProduction, CommandeClient, QuantiteBoutique, Produit, Client, RedistributionData } from '../types';
import { firestoreService, businessQueries, realTimeListeners, dateToTimestamp, timestampToDate } from '../firebase/collections';
import { db } from '../firebase/config';
import type { Timestamp } from 'firebase/firestore';




interface ProductionStore {
  // État
  programmeActuel: ProgrammeProduction | null;
  commandesClients: CommandeClient[];
  quantitesBoutique: QuantiteBoutique[];
  produits: Produit[];
  clients: Client[];
  isLoading: boolean;

  // Listener unsubscribe functions
  programListener: (() => void) | null;

  // État des formulaires (pour éviter la perte lors des changements d'onglet)
  showCommandeForm: boolean;
  showQuantiteBoutiqueForm: boolean;
  commandeEnEdition: CommandeClient | null;
  quantiteBoutiqueEnEdition: QuantiteBoutique | null;

  // État du formulaire commande (pour éviter la perte des produits en cours de saisie)
  formulaireCommande: {
    selectedClientId: string;
    dateLivraison: string;
    produitsCommandes: Array<{
      produitId: string;
      quantiteCommandee: number;
      prixUnitaire?: number;
      repartitionCars?: {
        car1_matin: number | string;
        car2_matin: number | string;
        car_soir: number | string;
      };
    }>;
    utiliserPrixClient: boolean;
  };

  // Actions Programme
  creerNouveauProgramme: (date: Date) => void;
  chargerProgramme: (date: Date) => Promise<void>;
  chargerProgrammeAvecListener: (date: Date) => void; // Nouvelle méthode avec listener temps réel
  sauvegarderProgramme: () => Promise<void>;
  sauvegarderEtRecharger: () => Promise<void>; // Sauvegarde + rechargement pour éviter les conflits
  envoyerAuBoulanger: () => Promise<void>;
  validerProduction: () => Promise<void>; // Action pour déduire les stocks
  marquerCommeModifie: () => void; // Marquer le programme comme modifié après envoi
  nettoyerListeners: () => void; // Nettoyer les listeners

  // Actions Commandes Clients
  ajouterCommandeClient: (commande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'>) => void;
  modifierCommandeClient: (id: string, commande: Partial<CommandeClient>) => void;
  supprimerCommandeClient: (id: string) => void;
  supprimerCommandesLivreur: (livreurId: string) => void;
  annulerCommandeClient: (id: string) => void;
  annulerCommandeAvecRedistribution: (commandeId: string, redistribution: RedistributionData) => Promise<void>;


  supprimerProduitDeCommande: (commandeId: string, produitIndex: number) => void;
  sauvegarderCommandeType: (clientId: string, produits: any[]) => Promise<void>;

  // Actions Quantités Boutique
  ajouterQuantiteBoutique: (quantite: QuantiteBoutique) => void;
  modifierQuantiteBoutique: (produitId: string, quantite: number) => void;
  supprimerQuantiteBoutique: (produitId: string) => void;

  // Actions Production Réelle
  setQuantiteProduite: (produitId: string, quantite: number) => void;

  // Actions Calculs
  calculerTotauxParProduit: () => void;
  modifierRepartitionProduit: (produitId: string, car1Matin: number, car2Matin: number, carSoir: number) => void;

  // Actions Référentiels
  chargerProduits: () => Promise<void>;
  chargerClients: () => Promise<void>;
  rafraichirDonnees: () => Promise<void>;

  // Actions Formulaires
  setShowCommandeForm: (show: boolean) => void;
  setShowQuantiteBoutiqueForm: (show: boolean) => void;
  setCommandeEnEdition: (commande: CommandeClient | null) => void;
  setQuantiteBoutiqueEnEdition: (quantite: QuantiteBoutique | null) => void;

  // Actions État Formulaire Commande
  updateFormulaireCommande: (updates: Partial<ProductionStore['formulaireCommande']>) => void;
  resetFormulaireCommande: () => void;

  // Setters
  setLoading: (loading: boolean) => void;

  // Fonction de débogage (à supprimer après nettoyage)
  nettoyerProgrammesEnDouble: () => Promise<void>;
  debugTotaux: () => void;
}

// Deux dates tombent-elles le même jour calendaire ? (tolère Date, Timestamp, string)
const memeJour = (a: any, b: any): boolean => {
  const toD = (v: any): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  const da = toD(a), db = toD(b);
  if (!da || !db) return false;
  return da.toDateString() === db.toDateString();
};

/**
 * Ne garde que les commandes livrées le jour du programme.
 * Empêche les commandes d'une autre journée (ex: la veille, restées en mémoire
 * lors d'un changement de date) de polluer le programme et de gonfler les
 * quantités à produire.
 */
const commandesDuJour = (commandes: any[], dateProduction: any): CommandeClient[] => {
  const gardees = (commandes || []).filter(c => memeJour(c.dateLivraison, dateProduction));
  const ecartees = (commandes || []).length - gardees.length;
  if (ecartees > 0) {
    console.warn(`⚠️ ${ecartees} commande(s) d'une autre journée écartée(s) du programme du ${new Date(dateProduction).toLocaleDateString('fr-FR')}`);
  }
  return gardees;
};

export const useProductionStore = create<ProductionStore>((set, get) => ({
  // État initial
  programmeActuel: null,
  commandesClients: [],
  quantitesBoutique: [],
  produits: [],
  clients: [],
  isLoading: false,

  // Listeners
  programListener: null,

  // État des formulaires
  showCommandeForm: false,
  showQuantiteBoutiqueForm: false,
  commandeEnEdition: null,
  quantiteBoutiqueEnEdition: null,

  // État du formulaire commande
  formulaireCommande: {
    selectedClientId: '',
    dateLivraison: new Date().toISOString().split('T')[0],
    produitsCommandes: [],
    utiliserPrixClient: true,
  },

  // Actions Programme

  creerNouveauProgramme: (date: Date) => {
    // La date passée EST la date de production
    const dateProduction = new Date(date);

    const nouveauProgramme: ProgrammeProduction = {
      id: `prog_${Date.now()}`,
      dateProduction: dateProduction,
      dateCreation: new Date(), // Date réelle de création (maintenant)
      statut: 'brouillon',
      commandesClients: [],
      quantitesBoutique: [],
      totauxParProduit: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    set({
      programmeActuel: nouveauProgramme,
      commandesClients: [],
      quantitesBoutique: []
    });

    // Calculer les totaux (vides au départ)
    get().calculerTotauxParProduit();

    console.log('✨ Nouveau programme créé pour', date.toLocaleDateString('fr-FR'));
  },

  chargerProgramme: async (date: Date) => {
    console.log('📅 Chargement programme pour date:', date);
    set({ isLoading: true });
    try {
      const programmes = await businessQueries.getProgrammeByDate(date);
      console.log('🔍 Programmes trouvés dans Firebase:', programmes.length);

      if (programmes.length > 0) {
        console.log('✅ Programme existant trouvé, chargement...');
        const programme = programmes[0] as any;
        // Convertir les timestamps en dates
        const programmeConverti: ProgrammeProduction = {
          ...programme,
          dateProduction: programme.dateProduction instanceof Date ? programme.dateProduction : timestampToDate(programme.dateProduction as Timestamp),
          dateCreation: programme.dateCreation instanceof Date ? programme.dateCreation : timestampToDate(programme.dateCreation as Timestamp),
          createdAt: programme.createdAt instanceof Date ? programme.createdAt : timestampToDate(programme.createdAt as Timestamp),
          updatedAt: programme.updatedAt instanceof Date ? programme.updatedAt : timestampToDate(programme.updatedAt as Timestamp),
          // Convertir les dates dans les commandes clients
          commandesClients: (programme.commandesClients || []).map((cmd: any) => ({
            ...cmd,
            dateCommande: cmd.dateCommande instanceof Date ? cmd.dateCommande : timestampToDate(cmd.dateCommande as Timestamp),
            dateLivraison: cmd.dateLivraison instanceof Date ? cmd.dateLivraison : timestampToDate(cmd.dateLivraison as Timestamp),
            createdAt: cmd.createdAt instanceof Date ? cmd.createdAt : timestampToDate(cmd.createdAt as Timestamp),
            updatedAt: cmd.updatedAt instanceof Date ? cmd.updatedAt : timestampToDate(cmd.updatedAt as Timestamp),
          })),
        };

        const cmdsJour = commandesDuJour(programmeConverti.commandesClients, programmeConverti.dateProduction);
        const contamine = cmdsJour.length !== (programmeConverti.commandesClients || []).length;
        set({
          programmeActuel: { ...programmeConverti, commandesClients: cmdsJour },
          commandesClients: cmdsJour,
          quantitesBoutique: programmeConverti.quantitesBoutique || [],
          isLoading: false
        });
        // Les totaux stockés incluaient les commandes parasites : on les recalcule.
        if (contamine) get().calculerTotauxParProduit();
        console.log('📋 Programme chargé avec', cmdsJour.length, 'commandes');
      } else {
        // Aucun programme trouvé, créer un nouveau programme automatiquement pour cette date
        console.log('❌ Aucun programme trouvé, création automatique...');

        // La date passée EST la date de production
        const dateProduction = new Date(date);

        const nouveauProgramme: ProgrammeProduction = {
          id: `prog_${Date.now()}`,
          dateProduction: dateProduction,
          dateCreation: new Date(), // Date réelle de création (maintenant)
          statut: 'brouillon',
          commandesClients: [],
          quantitesBoutique: [],
          totauxParProduit: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set({
          programmeActuel: nouveauProgramme,
          commandesClients: [],
          quantitesBoutique: [],
          isLoading: false
        });

        console.log('✨ Nouveau programme créé automatiquement pour', date.toLocaleDateString('fr-FR'));
      }
    } catch (error) {
      console.error('Erreur lors du chargement du programme:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  chargerProgrammeAvecListener: (date: Date) => {
    console.log('📡 Configuration listener temps réel pour:', date);

    // Nettoyer le listener précédent s'il existe
    const { programListener } = get();
    if (programListener) {
      programListener();
    }

    // Vider l'état AVANT l'arrivée du snapshot : sinon les commandes de la date
    // précédente restent en mémoire et peuvent être écrites dans le programme
    // de la nouvelle date (sauvegarderProgramme sort si programmeActuel est null).
    set({ isLoading: true, programmeActuel: null, commandesClients: [], quantitesBoutique: [] });

    // Configurer le nouveau listener
    const unsubscribe = realTimeListeners.subscribeToProgram(date, (programmes) => {
      console.log('🔄 Mise à jour temps réel - programmes reçus:', programmes.length);

      if (programmes.length > 0) {
        console.log('✅ Programme existant trouvé via listener, chargement...');
        const programme = programmes[0] as any;

        // Convertir les timestamps en dates
        const programmeConverti: ProgrammeProduction = {
          ...programme,
          dateProduction: programme.dateProduction instanceof Date ? programme.dateProduction : timestampToDate(programme.dateProduction as Timestamp),
          dateCreation: programme.dateCreation instanceof Date ? programme.dateCreation : timestampToDate(programme.dateCreation as Timestamp),
          createdAt: programme.createdAt instanceof Date ? programme.createdAt : timestampToDate(programme.createdAt as Timestamp),
          updatedAt: programme.updatedAt instanceof Date ? programme.updatedAt : timestampToDate(programme.updatedAt as Timestamp),
          // Convertir les dates dans les commandes clients
          commandesClients: (programme.commandesClients || []).map((cmd: any) => ({
            ...cmd,
            dateCommande: cmd.dateCommande instanceof Date ? cmd.dateCommande : timestampToDate(cmd.dateCommande as Timestamp),
            dateLivraison: cmd.dateLivraison instanceof Date ? cmd.dateLivraison : timestampToDate(cmd.dateLivraison as Timestamp),
            createdAt: cmd.createdAt instanceof Date ? cmd.createdAt : timestampToDate(cmd.createdAt as Timestamp),
            updatedAt: cmd.updatedAt instanceof Date ? cmd.updatedAt : timestampToDate(cmd.updatedAt as Timestamp),
          })),
        };

        const cmdsJour = commandesDuJour(programmeConverti.commandesClients, programmeConverti.dateProduction);
        const contamine = cmdsJour.length !== (programmeConverti.commandesClients || []).length;
        set({
          programmeActuel: { ...programmeConverti, commandesClients: cmdsJour },
          commandesClients: cmdsJour,
          quantitesBoutique: programmeConverti.quantitesBoutique || [],
          isLoading: false
        });
        // Les totaux stockés incluaient les commandes parasites : on les recalcule.
        if (contamine) get().calculerTotauxParProduit();

        console.log('🔄 Programme synchronisé avec', cmdsJour.length, 'commandes');
      } else {
        // Aucun programme trouvé, créer un nouveau programme
        console.log('❌ Aucun programme trouvé via listener, création automatique...');

        // La date passée EST la date de production
        const dateProduction = new Date(date);

        const nouveauProgramme: ProgrammeProduction = {
          id: `prog_${Date.now()}`,
          dateProduction: dateProduction,
          dateCreation: new Date(), // Date réelle de création (maintenant)
          statut: 'brouillon',
          commandesClients: [],
          quantitesBoutique: [],
          totauxParProduit: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set({
          programmeActuel: nouveauProgramme,
          commandesClients: [],
          quantitesBoutique: [],
          isLoading: false
        });

        console.log('✨ Nouveau programme créé automatiquement via listener pour', date.toLocaleDateString('fr-FR'));
      }
    });

    // Stocker la fonction de nettoyage
    set({ programListener: unsubscribe });
  },

  nettoyerListeners: () => {
    const { programListener } = get();
    if (programListener) {
      programListener();
      set({ programListener: null });
      console.log('🧹 Listeners nettoyés');
    }
  },

  sauvegarderProgramme: async () => {
    const { programmeActuel, commandesClients, quantitesBoutique } = get();
    if (!programmeActuel) return;

    set({ isLoading: true });
    try {
      // Garde-fou : ne jamais persister une commande d'une autre journée
      const cmdsJour = commandesDuJour(commandesClients, programmeActuel.dateProduction);

      const programmeAEnregistrer = {
        ...programmeActuel,
        commandesClients: cmdsJour,
        quantitesBoutique,
        dateProduction: dateToTimestamp(programmeActuel.dateProduction),
        dateCreation: dateToTimestamp(programmeActuel.dateCreation),
        createdAt: dateToTimestamp(programmeActuel.createdAt),
        updatedAt: dateToTimestamp(new Date())
      };


      const cleanData = (data: any): any => {
        if (data === undefined) return null;
        if (data === null) return null;
        if (data instanceof Date) return data;
        // Garder les Timestamp Firestore
        if (typeof data === 'object' && typeof data.toMillis === 'function') return data;

        if (Array.isArray(data)) {
          return data.map(cleanData);
        }
        if (typeof data === 'object') {
          const res: any = {};
          for (const k in data) {
            const val = cleanData(data[k]);
            // On garde les propriétés même si null, mais pas si undefined originalement ? 
            // Firestore accepte null. On a transformé undefined en null au début.
            res[k] = val;
          }
          return res;
        }
        return data;
      };

      const dataToSaveSafe = cleanData(programmeAEnregistrer);

      if (programmeActuel.id.startsWith('prog_')) {
        // Nouveau programme, l'ajouter
        const { id: _, ...dataContent } = dataToSaveSafe;
        const docRef = await firestoreService.create('productionPrograms', dataContent);

        set((state) => ({
          programmeActuel: state.programmeActuel ? {
            ...state.programmeActuel,
            id: docRef.id
          } : null,
          isLoading: false
        }));
      } else {
        // Programme existant, le mettre à jour
        const { id, ...dataContent } = dataToSaveSafe;
        await firestoreService.update('productionPrograms', id, dataContent);
        set({ isLoading: false });
      }

      // --- SYNC: Sauvegarder les commandes dans la collection 'clientOrders' ---
      // Cela permet à la facturation de les trouver indépendamment du programme
      console.log('🔄 Sync des commandes vers clientOrders...');
      try {
        const { writeBatch, doc, query, where, getDocs, collection } = await import('firebase/firestore');
        
        let dateProduction: Date;
        if (programmeActuel.dateProduction instanceof Date) {
          dateProduction = programmeActuel.dateProduction;
        } else if (programmeActuel.dateProduction && typeof (programmeActuel.dateProduction as any).toDate === 'function') {
          dateProduction = (programmeActuel.dateProduction as any).toDate();
        } else {
          dateProduction = new Date(programmeActuel.dateProduction);
        }

        // Bornes UTC pour correspondre au format de stockage (semblable à getProgrammeByDate)
        const dateStart = new Date(Date.UTC(dateProduction.getFullYear(), dateProduction.getMonth(), dateProduction.getDate(), 0, 0, 0));
        const dateEnd = new Date(Date.UTC(dateProduction.getFullYear(), dateProduction.getMonth(), dateProduction.getDate(), 23, 59, 59, 999));

        // Récupérer les commandes existantes dans Firestore pour cette date
        const qOrders = query(
          collection(db, 'clientOrders'),
          where('dateLivraison', '>=', dateToTimestamp(dateStart)),
          where('dateLivraison', '<=', dateToTimestamp(dateEnd))
        );
        const snapOrders = await getDocs(qOrders);
        const existingOrderIds = snapOrders.docs.map(doc => doc.id);

        const currentOrderIds = new Set(commandesClients.map(c => c.id));
        const orderIdsToDelete = existingOrderIds.filter(id => !currentOrderIds.has(id));

        let batch = writeBatch(db);
        let count = 0;

        // 1. Supprimer les commandes qui ne sont plus dans le programme
        for (const orderId of orderIdsToDelete) {
          batch.delete(doc(db, 'clientOrders', orderId));
          count++;
          if (count >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        // 2. Ajouter/mettre à jour les commandes actuelles
        for (const cmd of commandesClients) {
          const cmdRef = doc(db, 'clientOrders', cmd.id);
          // Conversion explicite des dates pour éviter les erreurs
          const dateLivStr = typeof cmd.dateLivraison === 'string' ? cmd.dateLivraison : (cmd.dateLivraison as Date).toISOString();
          const dateCmdStr = typeof cmd.dateCommande === 'string' ? cmd.dateCommande : (cmd.dateCommande as Date).toISOString();

          const cmdData = {
            ...cmd,
            dateLivraison: dateToTimestamp(new Date(dateLivStr)),
            dateCommande: dateToTimestamp(new Date(dateCmdStr)),
            updatedAt: dateToTimestamp(new Date())
          };

          batch.set(cmdRef, cmdData, { merge: true });
          count++;

          if (count >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
        console.log('✅ Commandes synchronisées avec succès');
      } catch (err) {
        console.error("Erreur sync commandes:", err);
      }
      // -----------------------------------------------------------------------

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  sauvegarderEtRecharger: async () => {
    const { programmeActuel } = get();
    if (!programmeActuel) return;

    try {
      // 1. Sauvegarder d'abord
      await get().sauvegarderProgramme();

      // 2. Recharger ensuite pour récupérer les données fraîches
      await get().chargerProgramme(programmeActuel.dateProduction);

      console.log('✅ Programme sauvegardé et rechargé pour éviter les conflits');
    } catch (error) {
      console.error('Erreur lors de sauvegarde+rechargement:', error);
      throw error;
    }
  },

  validerProduction: async () => {
    const { programmeActuel } = get();
    if (!programmeActuel) return;

    set({ isLoading: true });
    try {
      console.log('🏭 Validation de la production (sans déduction de stock automatique)...');

      // 1. Mettre à jour le statut du programme uniquement
      const programmeValide = {
        ...programmeActuel,
        statut: 'produit' as const,
        updatedAt: new Date()
      };

      await firestoreService.update('productionPrograms', programmeActuel.id, {
        statut: 'produit',
        updatedAt: new Date()
      });

      set({
        programmeActuel: programmeValide,
        isLoading: false
      });

      console.log('✅ Production validée (Stock à déclarer manuellement)');

    } catch (error) {
      console.error('Erreur validation production:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Helper pour marquer le programme comme modifié après envoi
  marquerCommeModifie: () => {
    const { programmeActuel } = get();
    if (programmeActuel && programmeActuel.statut === 'envoye') {
      set({
        programmeActuel: {
          ...programmeActuel,
          statut: 'modifie' as const,
          updatedAt: new Date()
        }
      });
    }
  },

  envoyerAuBoulanger: async () => {
    const { programmeActuel } = get();
    if (!programmeActuel) return;

    try {
      const programmeEnvoye = {
        ...programmeActuel,
        statut: 'envoye' as const,
        updatedAt: new Date()
      };

      // Sauvegarder d'abord localement
      set({ programmeActuel: programmeEnvoye });

      // Puis sauvegarder vers Firebase
      await get().sauvegarderProgramme();

    } catch (error) {
      console.error('Erreur lors de l\'envoi:', error);
      throw error;
    }
  },

  // Actions Commandes Clients
  ajouterCommandeClient: (commande) => {
    const nouvelleCommande: CommandeClient = {
      ...commande,
      id: `cmd_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => ({
      commandesClients: [...state.commandesClients, nouvelleCommande]
    }));

    // Recalculer et auto-sauvegarder immédiatement après l'ajout
    setTimeout(async () => {
      get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
      get().calculerTotauxParProduit();
      // Auto-sauvegarde avec rechargement pour éviter les conflits
      get().sauvegarderEtRecharger().catch(error => {
        console.warn('Auto-sauvegarde échouée:', error);
      });

      // --- AUTO-GENERATION FACTURE (DRAFT) ---
      try {
        const { programmeActuel } = get();
        if (programmeActuel && nouvelleCommande) {
          // Importer le store de facturation dynamiquement pour éviter les cycles si possible, ou utiliser getState
          // Note: On utilise require ou import en haut mais ici on suppose que useFacturationStore est dispo
          // import { useFacturationStore } from './facturationStore';
          const facturationModule = await import('./facturationStore') as any;
          const useFacturationStore = facturationModule.useFacturationStore;
          if (useFacturationStore) {
            const dateLivraison = new Date(nouvelleCommande.dateLivraison);
            // On passe TOUTES les commandes de ce programme pour cette date, pour être sûr
            const allCommandes = get().commandesClients.filter(c =>
              new Date(c.dateLivraison).toDateString() === dateLivraison.toDateString() &&
              c.statut !== 'annulee'
            );

            // On appelle la génération. Note: les retours sont vides pour l'instant (draft)
            console.log('🔄 Auto-génération de facture brouillon pour la commande...');
            useFacturationStore.getState().genererFacturesDepuisLivraisons(dateLivraison, allCommandes, [])
              .catch((err: any) => console.error('Erreur auto-gen facture:', err));
          }
        }
      } catch (e) {
        console.warn('Non bloquant: Erreur trigger facturation', e);
      }
      // ----------------------------------------

    }, 100);
  },

  modifierCommandeClient: (id, modifications) => {
    set((state) => ({
      commandesClients: state.commandesClients.map(cmd =>
        cmd.id === id
          ? { ...cmd, ...modifications, updatedAt: new Date() }
          : cmd
      )
    }));
    // Recalculer et auto-sauvegarder après la modification
    setTimeout(async () => {
      get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
      get().calculerTotauxParProduit();
      get().sauvegarderEtRecharger().catch(console.warn);

      // --- AUTO-UPDATE FACTURE (DRAFT) ---
      try {
        const commandeModifiee = get().commandesClients.find(c => c.id === id);
        if (commandeModifiee) {
          const facturationModule = await import('./facturationStore') as any;
          const useFacturationStore = facturationModule.useFacturationStore;
          if (useFacturationStore) {
            const dateLivraison = new Date(commandeModifiee.dateLivraison);
            const allCommandes = get().commandesClients.filter(c =>
              new Date(c.dateLivraison).toDateString() === dateLivraison.toDateString() &&
              c.statut !== 'annulee'
            );
            console.log('🔄 Auto-update de facture brouillon suite modif commande...');
            // On passe [] pour les retours, ce qui va garder les retours existants s'ils sont gérés intelligemment dans le store facturation
            // ou simplement regénérer le "brouillon" basé sur la commande.
            // IMPORTANT: genererFacturesDepuisLivraisons dans facturationStore doit être robuste.
            useFacturationStore.getState().genererFacturesDepuisLivraisons(dateLivraison, allCommandes, [])
              .catch((err: any) => console.error('Erreur auto-update facture:', err));
          }
        }
      } catch (e) {
        console.warn('Non bloquant: Erreur trigger facturation update', e);
      }
      // ----------------------------------------
    }, 100);
  },

  supprimerCommandeClient: (id) => {
    set((state) => ({
      commandesClients: state.commandesClients.filter(cmd => cmd.id !== id)
    }));
    // Recalculer et sauvegarder immédiatement après la suppression
    setTimeout(async () => {
      get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
      get().calculerTotauxParProduit();
      get().sauvegarderEtRecharger().catch(console.warn);

      // --- AUTO-UPDATE FACTURE ---
      try {
        const { programmeActuel } = get();
        if (programmeActuel) {
          const facturationModule = await import('./facturationStore') as any;
          const useFacturationStore = facturationModule.useFacturationStore;
          if (useFacturationStore) {
            const dateLivraison = new Date(programmeActuel.dateProduction);
            const allCommandes = get().commandesClients.filter(c =>
              new Date(c.dateLivraison).toDateString() === dateLivraison.toDateString() &&
              c.statut !== 'annulee'
            );
            console.log('🔄 Auto-update de facture suite suppression commande...');
            useFacturationStore.getState().genererFacturesDepuisLivraisons(dateLivraison, allCommandes, [])
              .catch((err: any) => console.error('Erreur auto-update facture:', err));
          }
        }
      } catch (e) {
        console.warn('Non bloquant: Erreur trigger facturation suppression', e);
      }
    }, 0);
  },

  supprimerCommandesLivreur: (livreurId) => {
    const { clients } = get();

    // Trouver tous les clients assignés à ce livreur
    const clientsLivreur = clients.filter(client =>
      client.livreurId === livreurId ||
      (client.livreursParCar && Object.values(client.livreursParCar).includes(livreurId))
    );
    const clientIds = clientsLivreur.map(client => client.id);

    console.log(`🗑️ Suppression des commandes pour le livreur ${livreurId}:`, clientsLivreur.map(c => c.nom));

    set((state) => {
      const commandesAvant = state.commandesClients.length;
      const nouvellesCommandes = state.commandesClients.filter(cmd => !clientIds.includes(cmd.clientId));
      const commandesApres = nouvellesCommandes.length;

      console.log(`📊 ${commandesAvant - commandesApres} commandes supprimées (${commandesAvant} -> ${commandesApres})`);

      return {
        commandesClients: nouvellesCommandes
      };
    });

    // Recalculer et sauvegarder immédiatement après la suppression
    setTimeout(() => {
      get().calculerTotauxParProduit();
      if (get().programmeActuel?.statut === 'brouillon') {
        get().sauvegarderEtRecharger().catch(console.warn);
      }
    }, 0);
  },

  annulerCommandeClient: (id) => {
    set((state) => ({
      commandesClients: state.commandesClients.map(cmd =>
        cmd.id === id
          ? { ...cmd, statut: 'annulee' as const, updatedAt: new Date() }
          : cmd
      )
    }));
    // Recalculer et sauvegarder après l'annulation
    setTimeout(async () => {
      get().calculerTotauxParProduit();
      get().sauvegarderEtRecharger().catch(console.warn);

      // --- AUTO-UPDATE FACTURE ---
      try {
        const commandeAnnulee = get().commandesClients.find(c => c.id === id);
        if (commandeAnnulee) {
          const facturationModule = await import('./facturationStore') as any;
          const useFacturationStore = facturationModule.useFacturationStore;
          if (useFacturationStore) {
            const dateLivraison = new Date(commandeAnnulee.dateLivraison);
            const allCommandes = get().commandesClients.filter(c =>
              new Date(c.dateLivraison).toDateString() === dateLivraison.toDateString() &&
              c.statut !== 'annulee'
            );
            console.log('🔄 Auto-update de facture suite annulation commande...');
            useFacturationStore.getState().genererFacturesDepuisLivraisons(dateLivraison, allCommandes, [])
              .catch((err: any) => console.error('Erreur auto-update facture:', err));
          }
        }
      } catch (e) {
        console.warn('Non bloquant: Erreur trigger facturation annulation', e);
      }
    }, 0);
  },

  annulerCommandeAvecRedistribution: async (commandeId: string, redistribution: RedistributionData) => {
    const { commandesClients, quantitesBoutique, programmeActuel } = get();
    const commande = commandesClients.find(c => c.id === commandeId);

    if (!commande || !programmeActuel) {
      throw new Error('Commande ou programme introuvable');
    }

    try {
      console.log('🔄 Annulation avec redistribution:', redistribution.type);

      // 1. Marquer la commande comme annulée
      set((state) => ({
        commandesClients: state.commandesClients.map(cmd =>
          cmd.id === commandeId
            ? {
              ...cmd,
              statut: 'annulee' as const,
              motifAnnulation: redistribution.motif,
              redistribution: redistribution,
              updatedAt: new Date()

            }
            : cmd
        )
      }));

      // 2. Redistribuer les produits selon le type
      if (redistribution.type === 'boutique') {
        // ========== TOUT VERS LA BOUTIQUE ==========
        commande.produits.forEach(produit => {
          const quantiteExistante = quantitesBoutique.find(q => q.produitId === produit.produitId);
          if (quantiteExistante) {
            get().modifierQuantiteBoutique(
              produit.produitId,
              quantiteExistante.quantite + produit.quantiteCommandee
            );
          } else {
            get().ajouterQuantiteBoutique({
              produitId: produit.produitId,
              produit: produit.produit,
              quantite: produit.quantiteCommandee
            });
          }
        });
      } else if (redistribution.type === 'client' && redistribution.clientId) {
        // ========== TOUT VERS UN AUTRE CLIENT ==========
        const commandeExistante = commandesClients.find(c =>
          c.clientId === redistribution.clientId &&
          new Date(c.dateLivraison).toDateString() === new Date(commande.dateLivraison).toDateString() &&
          c.statut !== 'annulee'
        );

        if (commandeExistante) {
          const nouveauxProduits = [...commandeExistante.produits];
          commande.produits.forEach(produit => {
            const produitExistant = nouveauxProduits.find(p => p.produitId === produit.produitId);
            if (produitExistant) {
              produitExistant.quantiteCommandee += produit.quantiteCommandee;
            } else {
              nouveauxProduits.push({
                produitId: produit.produitId,
                produit: produit.produit,
                quantiteCommandee: produit.quantiteCommandee,
                prixUnitaire: produit.prixUnitaire,
                repartitionCars: produit.repartitionCars
              });
            }
          });

          get().modifierCommandeClient(commandeExistante.id, {
            produits: nouveauxProduits,
            notes: (commandeExistante.notes || '') + `\n[Redistribué depuis ${commande.client?.nom || commande.clientId}]`
          });
        } else {
          const nouvelleCommande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'> = {
            clientId: redistribution.clientId,
            client: undefined,
            dateCommande: new Date(),
            dateLivraison: commande.dateLivraison,
            produits: commande.produits.map(p => ({
              produitId: p.produitId,
              produit: p.produit,
              quantiteCommandee: p.quantiteCommandee,
              prixUnitaire: p.prixUnitaire,
              repartitionCars: p.repartitionCars
            })),
            statut: 'confirmee',
            notes: `Redistribué depuis commande annulée (${commande.client?.nom || commande.clientId})`
          };
          get().ajouterCommandeClient(nouvelleCommande);
        }
      } else if (redistribution.type === 'mixte') {
        // ========== RÉPARTITION MIXTE ==========
        redistribution.repartition.forEach(repart => {
          const produit = commande.produits.find(p => p.produitId === repart.produitId);
          if (!produit) return;

          if (repart.quantiteVersBoutique > 0) {
            const quantiteExistante = quantitesBoutique.find(q => q.produitId === repart.produitId);
            if (quantiteExistante) {
              get().modifierQuantiteBoutique(
                repart.produitId,
                quantiteExistante.quantite + repart.quantiteVersBoutique
              );
            } else {
              get().ajouterQuantiteBoutique({
                produitId: repart.produitId,
                produit: produit.produit,
                quantite: repart.quantiteVersBoutique
              });
            }
          }

          if (repart.quantiteVersClient > 0 && repart.clientDestinataireId) {
            const commandeExistante = commandesClients.find(c =>
              c.clientId === repart.clientDestinataireId &&
              new Date(c.dateLivraison).toDateString() === new Date(commande.dateLivraison).toDateString() &&
              c.statut !== 'annulee'
            );

            if (commandeExistante) {
              const produitExistant = commandeExistante.produits.find(p => p.produitId === repart.produitId);
              if (produitExistant) {
                get().modifierCommandeClient(commandeExistante.id, {
                  produits: commandeExistante.produits.map(p =>
                    p.produitId === repart.produitId ? { ...p, quantiteCommandee: p.quantiteCommandee + repart.quantiteVersClient } : p
                  )
                });
              } else {
                get().modifierCommandeClient(commandeExistante.id, {
                  produits: [
                    ...commandeExistante.produits,
                    {
                      produitId: repart.produitId,
                      produit: produit.produit,
                      quantiteCommandee: repart.quantiteVersClient,
                      prixUnitaire: produit.prixUnitaire,
                      repartitionCars: produit.repartitionCars
                    }
                  ]
                });
              }
            } else {
              const nouvelleCommande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'> = {
                clientId: repart.clientDestinataireId,
                client: undefined,
                dateCommande: new Date(),
                dateLivraison: commande.dateLivraison,
                produits: [{
                  produitId: repart.produitId,
                  produit: produit.produit,
                  quantiteCommandee: repart.quantiteVersClient,
                  prixUnitaire: produit.prixUnitaire,
                  repartitionCars: produit.repartitionCars
                }],
                statut: 'confirmee',
                notes: `Redistribué depuis commande annulée (${commande.client?.nom || commande.clientId})`
              };
              get().ajouterCommandeClient(nouvelleCommande);
            }
          }
        });
      }


      // 3. Recalculer les totaux
      get().calculerTotauxParProduit();

      // 4. Sauvegarder
      await get().sauvegarderEtRecharger();

      console.log('✅ Commande annulée et produits redistribués avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la redistribution:', error);
      throw error;
    }
  },

  supprimerProduitDeCommande: (commandeId, produitIndex) => {

    set((state) => ({
      commandesClients: state.commandesClients.map(cmd => {
        if (cmd.id === commandeId) {
          const nouveauxProduits = [...cmd.produits];
          nouveauxProduits.splice(produitIndex, 1);

          // Si plus de produits, supprimer complètement la commande
          if (nouveauxProduits.length === 0) {
            return null; // Sera filtré après
          }

          return {
            ...cmd,
            produits: nouveauxProduits,
            updatedAt: new Date()
          };
        }
        return cmd;
      }).filter(cmd => cmd !== null) // Supprimer les commandes vides
    }));

    // Recalculer immédiatement après la suppression
    setTimeout(() => {
      get().calculerTotauxParProduit();
      if (get().programmeActuel?.statut === 'brouillon') {
        get().sauvegarderEtRecharger().catch(console.warn);
      }
    }, 100);
  },

  sauvegarderCommandeType: async (clientId, produits) => {
    try {
      // 1. Mise à jour Firestore
      await firestoreService.update('clients', clientId, {
        commandeType: produits,
        updatedAt: new Date()
      });

      // 2. Mise à jour état local
      set((state) => ({
        clients: state.clients.map(c =>
          c.id === clientId
            ? { ...c, commandeType: produits, updatedAt: new Date() }
            : c
        )
      }));

      console.log('✅ Commande type sauvegardée pour client', clientId);
    } catch (error) {
      console.error('Erreur sauvegarde commande type:', error);
      throw error;
    }
  },

  // Actions Quantités Boutique
  ajouterQuantiteBoutique: (quantite) => {
    set((state) => {
      const existingIndex = state.quantitesBoutique.findIndex(
        q => q.produitId === quantite.produitId
      );

      if (existingIndex >= 0) {
        // Mettre à jour la quantité existante
        const newQuantites = [...state.quantitesBoutique];
        newQuantites[existingIndex] = quantite;
        return { quantitesBoutique: newQuantites };
      } else {
        // Ajouter nouvelle quantité
        return {
          quantitesBoutique: [...state.quantitesBoutique, quantite]
        };
      }
    });
    get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
    get().calculerTotauxParProduit();
    // Sauvegarder automatiquement en base
    setTimeout(() => get().sauvegarderEtRecharger().catch(console.error), 0);
  },

  modifierQuantiteBoutique: (produitId, quantite) => {
    set((state) => ({
      quantitesBoutique: state.quantitesBoutique.map(q =>
        q.produitId === produitId
          ? { ...q, quantite }
          : q
      )
    }));
    get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
    get().calculerTotauxParProduit();
    // Sauvegarder automatiquement en base
    setTimeout(() => get().sauvegarderEtRecharger().catch(console.error), 0);
  },

  supprimerQuantiteBoutique: (produitId) => {
    set((state) => ({
      quantitesBoutique: state.quantitesBoutique.filter(q => q.produitId !== produitId)
    }));
    get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
    get().calculerTotauxParProduit();
    // Sauvegarder automatiquement en base
    setTimeout(() => get().sauvegarderEtRecharger().catch(console.error), 0);
  },

  // Actions Production Réelle
  setQuantiteProduite: (produitId, quantite) => {
    set((state) => {
      if (!state.programmeActuel) return {};

      const newProductionReelle = [...(state.programmeActuel.productionReelle || [])];
      const existingIndex = newProductionReelle.findIndex(p => p.produitId === produitId);

      if (existingIndex >= 0) {
        newProductionReelle[existingIndex] = { produitId, quantite };
      } else {
        newProductionReelle.push({ produitId, quantite });
      }

      return {
        programmeActuel: {
          ...state.programmeActuel,
          productionReelle: newProductionReelle
        }
      };
    });
    // Recalculer les totaux pour mettre à jour l'affichage
    get().calculerTotauxParProduit();
    // Sauvegarder
    setTimeout(() => get().sauvegarderEtRecharger().catch(console.error), 0);
  },

  // Actions Calculs
  calculerTotauxParProduit: () => {
    const { commandesClients, quantitesBoutique, produits } = get();


    const totauxMap = new Map<string, {
      totalClient: number;
      totalBoutique: number;
      repartitionCar1Matin: number;
      repartitionCar2Matin: number;
      repartitionCarSoir: number;
    }>();

    // Calculer totaux clients et répartitions par car (exclure les commandes annulées)
    commandesClients.filter(commande => commande.statut !== 'annulee').forEach(commande => {
      commande.produits.forEach(item => {
        const current = totauxMap.get(item.produitId) || {
          totalClient: 0,
          totalBoutique: 0,
          repartitionCar1Matin: 0,
          repartitionCar2Matin: 0,
          repartitionCarSoir: 0
        };

        // Calculer la quantité totale du produit depuis les répartitions
        const quantiteTotale = item.quantiteCommandee ||
          ((Number(item.repartitionCars?.car1_matin) || 0) +
            (Number(item.repartitionCars?.car2_matin) || 0) +
            (Number(item.repartitionCars?.car_soir) || 0));

        // Ajouter les répartitions par car
        const car1Matin = Number(item.repartitionCars?.car1_matin) || 0;
        const car2Matin = Number(item.repartitionCars?.car2_matin) || 0;
        const carSoir = Number(item.repartitionCars?.car_soir) || 0;

        totauxMap.set(item.produitId, {
          totalClient: current.totalClient + quantiteTotale,
          totalBoutique: current.totalBoutique,
          repartitionCar1Matin: current.repartitionCar1Matin + car1Matin,
          repartitionCar2Matin: current.repartitionCar2Matin + car2Matin,
          repartitionCarSoir: current.repartitionCarSoir + carSoir
        });
      });
    });

    // Ajouter totaux boutique avec répartition définie ou par défaut
    quantitesBoutique.forEach(item => {
      const current = totauxMap.get(item.produitId) || {
        totalClient: 0,
        totalBoutique: 0,
        repartitionCar1Matin: 0,
        repartitionCar2Matin: 0,
        repartitionCarSoir: 0
      };

      let boutiqueCar1Matin, boutiqueCar2Matin, boutiqueCarSoir;

      if (item.repartitionCars) {
        // Utiliser la répartition définie par l'utilisateur
        boutiqueCar1Matin = item.repartitionCars.car1_matin;
        boutiqueCar2Matin = item.repartitionCars.car2_matin;
        boutiqueCarSoir = item.repartitionCars.car_soir;
      } else {
        // Répartition par défaut de la boutique (35%/35%/30%)
        boutiqueCar1Matin = Math.ceil(item.quantite * 0.35);
        boutiqueCar2Matin = Math.ceil(item.quantite * 0.35);
        boutiqueCarSoir = item.quantite - boutiqueCar1Matin - boutiqueCar2Matin;
      }

      totauxMap.set(item.produitId, {
        totalClient: current.totalClient,
        totalBoutique: item.quantite,
        repartitionCar1Matin: current.repartitionCar1Matin + boutiqueCar1Matin,
        repartitionCar2Matin: current.repartitionCar2Matin + boutiqueCar2Matin,
        repartitionCarSoir: current.repartitionCarSoir + boutiqueCarSoir
      });
    });

    // Créer le tableau des totaux avec répartitions par car calculées depuis les commandes
    const totauxParProduit = Array.from(totauxMap.entries()).map(([produitId, totaux]) => {
      const produit = produits.find(p => p.id === produitId);
      const totalGlobal = totaux.totalClient + totaux.totalBoutique;

      // Récupérer la quantité réellement produite si saisie
      const realProdEntry = (get().programmeActuel?.productionReelle || []).find(p => p.produitId === produitId);
      const quantiteProduiteReelle = realProdEntry ? realProdEntry.quantite : undefined;

      return {
        produitId,
        produit,
        totalClient: totaux.totalClient,
        totalBoutique: totaux.totalBoutique,
        totalGlobal,
        quantiteProduiteReelle,
        repartitionCar1Matin: totaux.repartitionCar1Matin,
        repartitionCar2Matin: totaux.repartitionCar2Matin,
        repartitionCarSoir: totaux.repartitionCarSoir
      };
    });

    set((state) => ({
      programmeActuel: state.programmeActuel ? {
        ...state.programmeActuel,
        totauxParProduit
      } : null
    }));
  },

  modifierRepartitionProduit: (_produitId, _car1Matin, _car2Matin, _carSoir) => {
    // Cette fonction est maintenant obsolète car les répartitions sont calculées
    // automatiquement depuis les commandes clients individuelles.
    // On la garde pour la compatibilité mais elle ne fait plus rien.
  },

  // Actions Référentiels
  chargerProduits: async () => {
    try {
      const produits = await firestoreService.getAll<Produit>('produits');
      const produitsConverts = produits.map(produit => ({
        ...produit,
        createdAt: produit.createdAt instanceof Date ? produit.createdAt : timestampToDate(produit.createdAt as Timestamp),
        updatedAt: produit.updatedAt instanceof Date ? produit.updatedAt : timestampToDate(produit.updatedAt as Timestamp),
      })) as Produit[];

      set({ produits: produitsConverts.filter(p => p.active) });
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      throw error;
    }
  },

  chargerClients: async () => {
    try {
      const clients = await firestoreService.getAll<Client>('clients');
      const clientsConverts = clients.map(client => ({
        ...client,
        createdAt: client.createdAt instanceof Date ? client.createdAt : timestampToDate(client.createdAt as Timestamp),
        updatedAt: client.updatedAt instanceof Date ? client.updatedAt : timestampToDate(client.updatedAt as Timestamp),
      })) as Client[];

      set({ clients: clientsConverts.filter(c => c.active) });
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
      throw error;
    }
  },

  // Actions de rafraîchissement
  rafraichirDonnees: async () => {
    try {
      await Promise.all([
        get().chargerProduits(),
        get().chargerClients()
      ]);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      throw error;
    }
  },

  // Actions Formulaires
  setShowCommandeForm: (show) => {
    set({ showCommandeForm: show });
  },

  setShowQuantiteBoutiqueForm: (show) => {
    set({ showQuantiteBoutiqueForm: show });
  },

  setCommandeEnEdition: (commande) => {
    set({ commandeEnEdition: commande });
  },

  setQuantiteBoutiqueEnEdition: (quantite) => {
    set({ quantiteBoutiqueEnEdition: quantite });
  },

  // Actions État Formulaire Commande
  updateFormulaireCommande: (updates) => {
    set((state) => ({
      formulaireCommande: {
        ...state.formulaireCommande,
        ...updates
      }
    }));
  },

  resetFormulaireCommande: () => {
    set({
      formulaireCommande: {
        selectedClientId: '',
        dateLivraison: new Date().toISOString().split('T')[0],
        produitsCommandes: [],
        utiliserPrixClient: true,
      }
    });
  },

  // Setters
  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  // Fonction de débogage temporaire pour nettoyer les doublons
  nettoyerProgrammesEnDouble: async () => {
    try {
      console.log('🧹 Nettoyage des programmes en double...');

      // Récupérer tous les programmes
      const programmes = await firestoreService.getAll('productionPrograms');
      console.log(`📊 ${programmes.length} programmes trouvés`);

      // Grouper par date pour identifier les doublons
      const programsParDate = new Map<string, any[]>();

      programmes.forEach((prog: any) => {
        const dateKey = prog.dateProduction?.toDate ? prog.dateProduction.toDate().toDateString() : new Date(prog.dateProduction).toDateString();
        if (!programsParDate.has(dateKey)) {
          programsParDate.set(dateKey, []);
        }
        programsParDate.get(dateKey)!.push(prog);
      });

      // Supprimer les doublons (garder le plus récent)
      let suppressions = 0;
      for (const [date, progs] of programsParDate) {
        if (progs.length > 1) {
          console.log(`🔄 ${progs.length} programmes trouvés pour ${date}`);

          // Trier par updatedAt (garder le plus récent)
          progs.sort((a, b) => {
            const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt);
            const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt);
            return dateB.getTime() - dateA.getTime();
          });

          // Supprimer tous sauf le premier (plus récent)
          for (let i = 1; i < progs.length; i++) {
            await firestoreService.delete('productionPrograms', progs[i].id);
            suppressions++;
            console.log(`🗑️ Programme ${progs[i].id} supprimé`);
          }
        }
      }

      console.log(`✅ Nettoyage terminé - ${suppressions} programmes supprimés`);

    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      throw error;
    }
  },

  debugTotaux: () => {
    const { commandesClients, quantitesBoutique, programmeActuel } = get();

    console.log('=== DEBUG TOTAUX ===');
    console.log('📦 Commandes clients:', commandesClients.length);
    commandesClients.forEach((cmd, i) => {
      console.log(`  Commande ${i + 1}:`, cmd.produits.map(p => ({
        produit: p.produit?.nom,
        quantite: p.quantiteCommandee,
        repartition: p.repartitionCars
      })));
    });

    console.log('🏪 Quantités boutique:', quantitesBoutique.length);
    quantitesBoutique.forEach((qb, i) => {
      console.log(`  Boutique ${i + 1}:`, {
        produit: qb.produit?.nom,
        quantite: qb.quantite,
        repartition: qb.repartitionCars
      });
    });

    console.log('🎯 Totaux calculés:', programmeActuel?.totauxParProduit);

    if (programmeActuel?.totauxParProduit) {
      const car1Total = programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar1Matin || 0), 0);
      const car2Total = programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar2Matin || 0), 0);
      const carSoirTotal = programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCarSoir || 0), 0);

      console.log('🚚 Totaux par car:');
      console.log(`  Car 1 Matin: ${car1Total}`);
      console.log(`  Car 2 Matin: ${car2Total}`);
      console.log(`  Car Soir: ${carSoirTotal}`);
      console.log(`  TOTAL: ${car1Total + car2Total + carSoirTotal}`);
    }
  },
}));