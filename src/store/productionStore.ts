import { create } from 'zustand';
import type { ProgrammeProduction, CommandeClient, QuantiteBoutique, Produit, Client } from '../types';
import { firestoreService, businessQueries, dateToTimestamp, timestampToDate } from '../firebase/collections';
import type { Timestamp } from 'firebase/firestore';

interface ProductionStore {
  // État
  programmeActuel: ProgrammeProduction | null;
  commandesClients: CommandeClient[];
  quantitesBoutique: QuantiteBoutique[];
  produits: Produit[];
  clients: Client[];
  isLoading: boolean;

  // État des formulaires (pour éviter la perte lors des changements d'onglet)
  showCommandeForm: boolean;
  showQuantiteBoutiqueForm: boolean;
  commandeEnEdition: CommandeClient | null;

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
  sauvegarderProgramme: () => Promise<void>;
  envoyerAuBoulanger: () => Promise<void>;

  // Actions Commandes Clients
  ajouterCommandeClient: (commande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'>) => void;
  modifierCommandeClient: (id: string, commande: Partial<CommandeClient>) => void;
  supprimerCommandeClient: (id: string) => void;
  supprimerCommandesLivreur: (livreurId: string) => void;
  annulerCommandeClient: (id: string) => void;

  supprimerProduitDeCommande: (commandeId: string, produitIndex: number) => void;
  sauvegarderCommandeType: (clientId: string, produits: any[]) => Promise<void>;

  // Actions Quantités Boutique
  ajouterQuantiteBoutique: (quantite: QuantiteBoutique) => void;
  modifierQuantiteBoutique: (produitId: string, quantite: number) => void;
  supprimerQuantiteBoutique: (produitId: string) => void;

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

  // Actions État Formulaire Commande
  updateFormulaireCommande: (updates: Partial<ProductionStore['formulaireCommande']>) => void;
  resetFormulaireCommande: () => void;

  // Setters
  setLoading: (loading: boolean) => void;
}

export const useProductionStore = create<ProductionStore>((set, get) => ({
  // État initial
  programmeActuel: null,
  commandesClients: [],
  quantitesBoutique: [],
  produits: [],
  clients: [],
  isLoading: false,

  // État des formulaires
  showCommandeForm: false,
  showQuantiteBoutiqueForm: false,
  commandeEnEdition: null,

  // État du formulaire commande
  formulaireCommande: {
    selectedClientId: '',
    dateLivraison: new Date().toISOString().split('T')[0],
    produitsCommandes: [],
    utiliserPrixClient: true,
  },

  // Actions Programme

  creerNouveauProgramme: (date: Date) => {
    const nouveauProgramme: ProgrammeProduction = {
      id: `prog_${Date.now()}`,
      date,
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
          date: programme.date instanceof Date ? programme.date : timestampToDate(programme.date as Timestamp),
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

        set({
          programmeActuel: programmeConverti,
          commandesClients: programmeConverti.commandesClients || [],
          quantitesBoutique: programmeConverti.quantitesBoutique || [],
          isLoading: false
        });
        console.log('📋 Programme chargé avec', programmeConverti.commandesClients?.length || 0, 'commandes');
      } else {
        // Aucun programme trouvé, créer un nouveau programme automatiquement
        console.log('❌ Aucun programme trouvé, création automatique...');

        const nouveauProgramme: ProgrammeProduction = {
          id: `prog_${Date.now()}`,
          date,
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

  sauvegarderProgramme: async () => {
    const { programmeActuel, commandesClients, quantitesBoutique } = get();
    if (!programmeActuel) return;

    set({ isLoading: true });
    try {
      const programmeAEnregistrer = {
        ...programmeActuel,
        commandesClients,
        quantitesBoutique,
        date: dateToTimestamp(programmeActuel.date),
        createdAt: dateToTimestamp(programmeActuel.createdAt),
        updatedAt: dateToTimestamp(new Date())
      };

      if (programmeActuel.id.startsWith('prog_')) {
        // Nouveau programme, l'ajouter

        const { id: _, ...dataToSave } = programmeAEnregistrer;
        const docRef = await firestoreService.create('productionPrograms', dataToSave);

        set((state) => ({
          programmeActuel: state.programmeActuel ? {
            ...state.programmeActuel,
            id: docRef.id
          } : null,
          isLoading: false
        }));
      } else {
        // Programme existant, le mettre à jour
        const { id, ...dataToUpdate } = programmeAEnregistrer;
        await firestoreService.update('productionPrograms', id, dataToUpdate);
        set({ isLoading: false });
      }

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      set({ isLoading: false });
      throw error;
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
    setTimeout(() => {
      get().calculerTotauxParProduit();
      // Auto-sauvegarde pour éviter la perte de données
      if (get().programmeActuel?.statut === 'brouillon') {
        get().sauvegarderProgramme().catch(error => {
          console.warn('Auto-sauvegarde échouée:', error);
        });
      }
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
    setTimeout(() => {
      get().calculerTotauxParProduit();
      if (get().programmeActuel?.statut === 'brouillon') {
        get().sauvegarderProgramme().catch(console.warn);
      }
    }, 100);
  },

  supprimerCommandeClient: (id) => {
    set((state) => ({
      commandesClients: state.commandesClients.filter(cmd => cmd.id !== id)
    }));
    // Recalculer et sauvegarder immédiatement après la suppression
    setTimeout(() => {
      get().calculerTotauxParProduit();
      if (get().programmeActuel?.statut === 'brouillon') {
        get().sauvegarderProgramme().catch(console.warn);
      }
    }, 0);
  },

  supprimerCommandesLivreur: (livreurId) => {
    const { clients } = get();

    // Trouver tous les clients assignés à ce livreur
    const clientsLivreur = clients.filter(client => client.livreurId === livreurId);
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
        get().sauvegarderProgramme().catch(console.warn);
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
    // Recalculer immédiatement après l'annulation
    setTimeout(() => get().calculerTotauxParProduit(), 0);
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
        get().sauvegarderProgramme().catch(console.warn);
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
    get().calculerTotauxParProduit();
    // Sauvegarder automatiquement en base
    setTimeout(() => get().sauvegarderProgramme().catch(console.error), 0);
  },

  modifierQuantiteBoutique: (produitId, quantite) => {
    set((state) => ({
      quantitesBoutique: state.quantitesBoutique.map(q =>
        q.produitId === produitId
          ? { ...q, quantite }
          : q
      )
    }));
    get().calculerTotauxParProduit();
    // Sauvegarder automatiquement en base
    setTimeout(() => get().sauvegarderProgramme().catch(console.error), 0);
  },

  supprimerQuantiteBoutique: (produitId) => {
    set((state) => ({
      quantitesBoutique: state.quantitesBoutique.filter(q => q.produitId !== produitId)
    }));
    get().calculerTotauxParProduit();
    // Sauvegarder automatiquement en base
    setTimeout(() => get().sauvegarderProgramme().catch(console.error), 0);
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

    // Ajouter totaux boutique (répartition par défaut pour la boutique)
    quantitesBoutique.forEach(item => {
      const current = totauxMap.get(item.produitId) || {
        totalClient: 0,
        totalBoutique: 0,
        repartitionCar1Matin: 0,
        repartitionCar2Matin: 0,
        repartitionCarSoir: 0
      };

      // Répartition par défaut de la boutique (35%/35%/30%)
      const boutiqueCar1Matin = Math.ceil(item.quantite * 0.35);
      const boutiqueCar2Matin = Math.ceil(item.quantite * 0.35);
      const boutiqueCarSoir = item.quantite - boutiqueCar1Matin - boutiqueCar2Matin;

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

      return {
        produitId,
        produit,
        totalClient: totaux.totalClient,
        totalBoutique: totaux.totalBoutique,
        totalGlobal,
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
}));