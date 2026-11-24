import { create } from 'zustand';

import type { ProgrammeProduction, CommandeClient, QuantiteBoutique, Produit, Client, RedistributionData } from '../types';
import { firestoreService, businessQueries, realTimeListeners, dateToTimestamp, timestampToDate } from '../firebase/collections';
import { activerModeSecours } from '../firebase/config';
import { Timestamp } from 'firebase/firestore';
import { useStockStore } from './stockStore';
import { addToSyncQueue } from '../utils/syncQueue';




interface ProductionStore {
  // État
  programmeActuel: ProgrammeProduction | null;
  commandesClients: CommandeClient[];
  quantitesBoutique: QuantiteBoutique[];
  produits: Produit[];
  clients: Client[];
  isLoading: boolean;
  isSaving: boolean;

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
  validerProduction: (sacsFarine?: number) => Promise<void>; // Action pour déduire les stocks de farine
  marquerCommeModifie: () => void; // Marquer le programme comme modifié après envoi
  nettoyerListeners: () => void; // Nettoyer les listeners
  declencherAutoSauvegarde: () => void;

  // Actions Commandes Clients
  ajouterCommandeClient: (commande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'>) => void;
  ajouterCommandesClientsMultiples: (commandes: Array<Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  modifierCommandeClient: (id: string, commande: Partial<CommandeClient>) => void;
  supprimerCommandeClient: (id: string) => void;
  supprimerCommandesLivreur: (livreurId: string) => void;
  annulerCommandeClient: (id: string) => void;
  annulerCommandeAvecRedistribution: (commandeId: string, redistribution: RedistributionData) => Promise<void>;


  supprimerProduitDeCommande: (commandeId: string, produitIndex: number) => void;
  sauvegarderCommandeType: (clientId: string, produits: any[]) => Promise<void>;
  sauvegarderCommandeTypeWeekend: (clientId: string, produits: any[]) => Promise<void>;

  // Actions Quantités Boutique
  ajouterQuantiteBoutique: (quantite: QuantiteBoutique) => void;
  ajouterQuantitesBoutiqueMultiples: (quantites: QuantiteBoutique[]) => void;
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

// Extraction sécurisée de la date calendaire YYYY-MM-DD
export const extraireDateCalendaire = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') {
    const match = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = v instanceof Date ? v : (typeof v.toDate === 'function' ? v.toDate() : new Date(v));
  if (isNaN(d.getTime())) return null;

  // Si l'heure est exactement 00:00:00 UTC (format standard de stockage des dates UTC)
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return d.toISOString().slice(0, 10);
  }

  // Sinon utiliser la date locale du client YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseDateAny = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d.toDate === 'function') return d.toDate();
  if (typeof d.toMillis === 'function') return new Date(d.toMillis());
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const cleanData = (data: any): any => {
  if (data === undefined) return null;
  if (data === null) return null;
  if (data instanceof Date) return data;
  if (typeof data === 'object' && typeof data.toMillis === 'function') return data;
  if (typeof data === 'object' && typeof data.isEqual === 'function' && 'seconds' in data) return data;
  if (typeof data === 'object' && typeof data.seconds === 'number' && typeof data.nanoseconds === 'number') {
    return new Timestamp(data.seconds, data.nanoseconds);
  }

  if (Array.isArray(data)) {
    return data.map(cleanData);
  }
  if (typeof data === 'object') {
    const res: any = {};
    for (const k in data) {
      res[k] = cleanData(data[k]);
    }
    return res;
  }
  return data;
};

export const restaurerProgrammeLocalStorage = (calKey: string): ProgrammeProduction | null => {
  try {
    const raw = localStorage.getItem(`boulangerie_programme_${calKey}`);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      ...p,
      dateProduction: parseDateAny(p.dateProduction),
      dateCreation: parseDateAny(p.dateCreation),
      createdAt: parseDateAny(p.createdAt),
      updatedAt: parseDateAny(p.updatedAt),
      commandesClients: (p.commandesClients || []).map((cmd: any) => ({
        ...cmd,
        dateCommande: parseDateAny(cmd.dateCommande),
        dateLivraison: parseDateAny(cmd.dateLivraison),
        createdAt: parseDateAny(cmd.createdAt),
        updatedAt: parseDateAny(cmd.updatedAt),
      })),
      quantitesBoutique: p.quantitesBoutique || [],
      totauxParProduit: p.totauxParProduit || [],
    };
  } catch (e) {
    console.warn(`Erreur lecture cache local programme ${calKey}:`, e);
    return null;
  }
};

// Deux dates tombent-elles le même jour calendaire ? (tolère Date, Timestamp, string et décalages UTC/local)
const memeJour = (a: any, b: any): boolean => {
  const ka = extraireDateCalendaire(a);
  const kb = extraireDateCalendaire(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;

  // Tolérance fuseaux horaires : vérifier les représentations UTC et locales
  const getKeys = (v: any): string[] => {
    if (!v) return [];
    if (typeof v === 'string') {
      const match = v.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? [match[1]] : [];
    }
    const d = v instanceof Date ? v : (typeof v.toDate === 'function' ? v.toDate() : new Date(v));
    if (isNaN(d.getTime())) return [];
    const utcK = d.toISOString().slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const locK = `${y}-${m}-${day}`;
    return [utcK, locK];
  };

  const keysA = getKeys(a);
  const keysB = getKeys(b);
  return keysA.some(k => keysB.includes(k));
};

/**
 * Ne garde que les commandes livrées le jour du programme.
 * Empêche les commandes d'une autre journée de polluer le programme.
 */
const commandesDuJour = (commandes: any[], dateProduction: any): CommandeClient[] => {
  if (!commandes || commandes.length === 0) return [];
  if (!dateProduction) return commandes;

  const gardees = (commandes || []).filter(c => {
    // Si la commande n'a pas de date de livraison spécifiée, on la conserve car elle fait partie du document
    if (!c.dateLivraison) return true;
    return memeJour(c.dateLivraison, dateProduction);
  });
  const ecartees = (commandes || []).length - gardees.length;
  if (ecartees > 0) {
    console.warn(`⚠️ ${ecartees} commande(s) d'une autre journée écartée(s) du programme du ${new Date(dateProduction).toLocaleDateString('fr-FR')}`);
  }
  return gardees;
};

// Gestion de l'auto-sauvegarde avec debounce et mutex pour éviter les écritures concurrentes et les doublons
let autoSaveTimeout: any = null;
let isSavingInProgress = false;
let pendingSaveRequested = false;

export const useProductionStore = create<ProductionStore>((set, get) => ({
  // État initial
  programmeActuel: null,
  commandesClients: [],
  quantitesBoutique: [],
  produits: [],
  clients: [],
  isLoading: false,
  isSaving: false,

  // Listeners
  programListener: null,

  declencherAutoSauvegarde: () => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    autoSaveTimeout = setTimeout(async () => {
      autoSaveTimeout = null;
      if (isSavingInProgress) {
        pendingSaveRequested = true;
        return;
      }
      isSavingInProgress = true;
      set({ isSaving: true });
      try {
        await Promise.race([
          get().sauvegarderProgramme(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout auto-sauvegarde')), 4500))
        ]);
      } catch (error) {
        console.warn('Auto-sauvegarde différée ou quota:', error);
      } finally {
        isSavingInProgress = false;
        set({ isSaving: false });
        if (pendingSaveRequested) {
          pendingSaveRequested = false;
          get().declencherAutoSauvegarde();
        }
      }
    }, 1500);
  },

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
    const calKey = extraireDateCalendaire(date) || (date instanceof Date ? date.toISOString().split('T')[0] : String(date));
    
    // Vérifier si un programme existe déjà dans le cache local
    const localExistant = restaurerProgrammeLocalStorage(calKey);
    if (localExistant && ((localExistant.commandesClients && localExistant.commandesClients.length > 0) || (localExistant.quantitesBoutique && localExistant.quantitesBoutique.length > 0) || localExistant.statut === 'envoye')) {
      console.log('📦 Programme déjà présent dans le cache local, restauration au lieu de créer un brouillon vide');
      set({
        programmeActuel: localExistant,
        commandesClients: localExistant.commandesClients || [],
        quantitesBoutique: localExistant.quantitesBoutique || [],
        isLoading: false
      });
      get().calculerTotauxParProduit();
      return;
    }

    const dateProduction = new Date(calKey + 'T00:00:00.000Z');

    const nouveauProgramme: ProgrammeProduction = {
      id: `prog_${Date.now()}`,
      dateProduction: dateProduction,
      dateCreation: new Date(),
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

    try {
      localStorage.setItem(`boulangerie_programme_${calKey}`, JSON.stringify(nouveauProgramme));
    } catch (_) {}

    get().calculerTotauxParProduit();
    console.log('✨ Nouveau programme créé pour', calKey);
  },

  chargerProgramme: async (date: Date) => {
    const calKey = extraireDateCalendaire(date) || (date instanceof Date ? date.toISOString().split('T')[0] : String(date));
    console.log('📅 Chargement programme pour date:', calKey);

    // 1. Priorité absolue : charger immédiatement depuis le cache local (0ms latence)
    const localProg = restaurerProgrammeLocalStorage(calKey);
    if (localProg) {
      set({
        programmeActuel: localProg,
        commandesClients: localProg.commandesClients || [],
        quantitesBoutique: localProg.quantitesBoutique || [],
        isLoading: false
      });
      get().calculerTotauxParProduit();
      console.log('📦 Programme restauré immédiatement depuis le cache local pour', calKey);
    } else {
      set({ isLoading: true });
    }

    try {
      const programmes = await Promise.race([
        businessQueries.getProgrammeByDate(date),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);

      console.log('🔍 Programmes trouvés dans Firebase:', (programmes || []).length);

      if (programmes && programmes.length > 0) {
        const programme = programmes[0] as any;
        const programmeConverti: ProgrammeProduction = {
          ...programme,
          dateProduction: parseDateAny(programme.dateProduction),
          dateCreation: parseDateAny(programme.dateCreation),
          createdAt: parseDateAny(programme.createdAt),
          updatedAt: parseDateAny(programme.updatedAt),
          commandesClients: (programme.commandesClients || []).map((cmd: any) => ({
            ...cmd,
            dateCommande: parseDateAny(cmd.dateCommande),
            dateLivraison: parseDateAny(cmd.dateLivraison),
            createdAt: parseDateAny(cmd.createdAt),
            updatedAt: parseDateAny(cmd.updatedAt),
          })),
        };

        const cmdsJour = commandesDuJour(programmeConverti.commandesClients, programmeConverti.dateProduction);

        // Ne remplacer la version locale que si la version distante est plus récente
        const remoteTime = programmeConverti.updatedAt.getTime();
        const localTime = localProg ? localProg.updatedAt.getTime() : 0;

        if (!localProg || remoteTime >= localTime) {
          set({
            programmeActuel: { ...programmeConverti, commandesClients: cmdsJour },
            commandesClients: cmdsJour,
            quantitesBoutique: programmeConverti.quantitesBoutique || [],
            isLoading: false
          });
          get().calculerTotauxParProduit();
          try {
            localStorage.setItem(`boulangerie_programme_${calKey}`, JSON.stringify(get().programmeActuel));
          } catch (_) {}
          console.log('☁️ Programme synchronisé depuis Firebase');
        } else {
          console.log('🛡️ Version locale conservée (plus récente que Firebase)');
        }
      } else if (!localProg) {
        // Vraiment aucun programme trouvé : créer automatiquement un nouveau programme
        const { programmeActuel: existingProg } = get();
        const memeJourDate = existingProg ? memeJour(existingProg.dateProduction, date) : false;
        if (existingProg && memeJourDate && ((existingProg.commandesClients && existingProg.commandesClients.length > 0) || (existingProg.quantitesBoutique && existingProg.quantitesBoutique.length > 0))) {
          set({ isLoading: false });
          return;
        }

        const dateProduction = new Date(calKey + 'T00:00:00.000Z');
        const nouveauProgramme: ProgrammeProduction = {
          id: `prog_${Date.now()}`,
          dateProduction,
          dateCreation: new Date(),
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
        get().calculerTotauxParProduit();
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      console.warn('⚠️ Requête Firebase programme ignorée (mode local actif ou quota):', error?.message || error);
      if (error?.code === 'resource-exhausted') {
        activerModeSecours().catch(() => {});
      }
      // Si nous n'avions pas de programme chargé, s'assurer que le local ou un brouillon est actif
      if (!get().programmeActuel) {
        const fallbackLocal = restaurerProgrammeLocalStorage(calKey);
        if (fallbackLocal) {
          set({
            programmeActuel: fallbackLocal,
            commandesClients: fallbackLocal.commandesClients || [],
            quantitesBoutique: fallbackLocal.quantitesBoutique || [],
            isLoading: false
          });
          get().calculerTotauxParProduit();
        } else {
          const dateProduction = new Date(calKey + 'T00:00:00.000Z');
          const nouveauProgramme: ProgrammeProduction = {
            id: `prog_${Date.now()}`,
            dateProduction,
            dateCreation: new Date(),
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
          get().calculerTotauxParProduit();
        }
      } else {
        set({ isLoading: false });
      }
    }
  },

  chargerProgrammeAvecListener: (date: Date) => {
    const calKey = extraireDateCalendaire(date) || (date instanceof Date ? date.toISOString().split('T')[0] : String(date));
    console.log('📡 Configuration listener temps réel pour:', calKey);

    const { programListener } = get();
    if (programListener) {
      programListener();
    }

    // Charger immédiatement le programme local s'il existe pour zéro latence
    const localProg = restaurerProgrammeLocalStorage(calKey);
    if (localProg) {
      set({
        programmeActuel: localProg,
        commandesClients: localProg.commandesClients || [],
        quantitesBoutique: localProg.quantitesBoutique || [],
        isLoading: false
      });
      get().calculerTotauxParProduit();
      console.log('📦 Programme pré-chargé depuis cache local pour listener');
    } else {
      set({ isLoading: true, programmeActuel: null, commandesClients: [], quantitesBoutique: [] });
    }

    const unsubscribe = realTimeListeners.subscribeToProgram(date, (programmes) => {
      console.log('🔄 Mise à jour temps réel - programmes reçus:', programmes.length);

      if (programmes.length > 0) {
        const progsTries = [...programmes].sort((a: any, b: any) => {
          const aCount = (a.commandesClients?.length || 0) + (a.quantitesBoutique?.length || 0);
          const bCount = (b.commandesClients?.length || 0) + (b.quantitesBoutique?.length || 0);
          if (aCount !== bCount) return bCount - aCount;

          const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt || 0).getTime();
          const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt || 0).getTime();
          return timeB - timeA;
        });

        const programme = progsTries[0] as any;
        const programmeConverti: ProgrammeProduction = {
          ...programme,
          dateProduction: parseDateAny(programme.dateProduction),
          dateCreation: parseDateAny(programme.dateCreation),
          createdAt: parseDateAny(programme.createdAt),
          updatedAt: parseDateAny(programme.updatedAt),
          commandesClients: (programme.commandesClients || []).map((cmd: any) => ({
            ...cmd,
            dateCommande: parseDateAny(cmd.dateCommande),
            dateLivraison: parseDateAny(cmd.dateLivraison),
            createdAt: parseDateAny(cmd.createdAt),
            updatedAt: parseDateAny(cmd.updatedAt),
          })),
        };

        const cmdsJour = commandesDuJour(programmeConverti.commandesClients, programmeConverti.dateProduction);
        const currentLocal = restaurerProgrammeLocalStorage(calKey);
        const localTime = currentLocal ? currentLocal.updatedAt.getTime() : 0;
        const remoteTime = programmeConverti.updatedAt.getTime();

        if (!currentLocal || remoteTime >= localTime) {
          set({
            programmeActuel: { ...programmeConverti, commandesClients: cmdsJour },
            commandesClients: cmdsJour,
            quantitesBoutique: programmeConverti.quantitesBoutique || [],
            isLoading: false
          });
          get().calculerTotauxParProduit();
          try {
            localStorage.setItem(`boulangerie_programme_${calKey}`, JSON.stringify(get().programmeActuel));
          } catch (_) {}
        }
      } else {
        const { programmeActuel: existingProg } = get();
        const memeJourDate = existingProg ? memeJour(existingProg.dateProduction, date) : false;
        if (isSavingInProgress || (existingProg && memeJourDate && ((existingProg.commandesClients && existingProg.commandesClients.length > 0) || (existingProg.quantitesBoutique && existingProg.quantitesBoutique.length > 0)))) {
          set({ isLoading: false });
          return;
        }

        const dateProduction = new Date(calKey + 'T00:00:00.000Z');
        const nouveauProgramme: ProgrammeProduction = {
          id: `prog_${Date.now()}`,
          dateProduction,
          dateCreation: new Date(),
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
      }
    }, (error) => {
      console.warn('❌ Erreur listener programme (sécurisé):', error?.message || error);
      if (error?.code === 'resource-exhausted') {
        activerModeSecours().catch(() => {});
      }
      if (!get().programmeActuel) {
        const localFallback = restaurerProgrammeLocalStorage(calKey);
        if (localFallback) {
          set({
            programmeActuel: localFallback,
            commandesClients: localFallback.commandesClients || [],
            quantitesBoutique: localFallback.quantitesBoutique || [],
            isLoading: false
          });
          get().calculerTotauxParProduit();
        } else {
          set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
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

    set({ isSaving: true });
    try {
      // Garde-fou : ne jamais persister une commande d'une autre journée
      const cmdsJour = commandesDuJour(commandesClients, programmeActuel.dateProduction);

      const cal = extraireDateCalendaire(programmeActuel.dateProduction);
      const dateProductionNorm = cal ? new Date(cal + 'T00:00:00.000Z') : new Date(programmeActuel.dateProduction);

      const programmeAEnregistrer = {
        ...programmeActuel,
        commandesClients: cmdsJour,
        quantitesBoutique,
        dateProduction: dateToTimestamp(dateProductionNorm),
        dateCreation: dateToTimestamp(programmeActuel.dateCreation),
        createdAt: dateToTimestamp(programmeActuel.createdAt),
        updatedAt: dateToTimestamp(new Date())
      };

      const dataToSaveSafe = cleanData(programmeAEnregistrer);

      // 1. Sauvegarde locale immédiate (LocalStorage) pour zéro blocage
      const calKey = cal || dateProductionNorm.toISOString().split('T')[0];
      try {
        localStorage.setItem(`boulangerie_programme_${calKey}`, JSON.stringify(programmeAEnregistrer));
      } catch (_) {}

      // 2. File d'attente automatique de synchronisation pour Firebase
      addToSyncQueue({
        type: 'programme_production',
        data: {
          id: programmeActuel.id,
          data: dataToSaveSafe
        }
      });

      // 3. Sauvegarde Firestore directe protégée par un timeout strict (2000ms max)
      try {
        if (programmeActuel.id.startsWith('prog_')) {
          // Nouveau programme, l'ajouter
          const { id: _, ...dataContent } = dataToSaveSafe;
          const docRef = await Promise.race([
            firestoreService.create('productionPrograms', dataContent),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
          ]);

          set((state) => ({
            programmeActuel: state.programmeActuel ? {
              ...state.programmeActuel,
              id: (docRef as any).id
            } : null,
            isLoading: false
          }));
        } else {
          // Programme existant, le mettre à jour
          const { id, ...dataContent } = dataToSaveSafe;
          await Promise.race([
            firestoreService.update('productionPrograms', id, dataContent),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
          ]);
          set({ isLoading: false });
        }
      } catch (err: any) {
        console.warn('⚠️ Programme sauvegardé en local (Firestore inaccessible ou quota):', err?.message || err);
        if (err?.code === 'resource-exhausted') {
          activerModeSecours().catch(() => {});
        }
      }

    } catch (error) {
      console.warn('Sauvegarde programme traitée en local:', error);
    } finally {
      isSavingInProgress = false;
      set({ isLoading: false, isSaving: false });
    }
  },

  sauvegarderEtRecharger: async () => {
    const { programmeActuel } = get();
    if (!programmeActuel) return;

    try {
      await get().sauvegarderProgramme();
      console.log('✅ Programme sauvegardé avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      throw error;
    }
  },

  validerProduction: async (sacsFarine?: number) => {
    const { programmeActuel } = get();
    if (!programmeActuel) return;

    set({ isLoading: true });
    try {
      const nbSacs = sacsFarine !== undefined ? Number(sacsFarine) : (Number(programmeActuel.sacsFarinePetris) || 0);

      // Si un nombre de sacs de farine pétris est renseigné, déduire automatiquement du stock
      if (nbSacs > 0) {
        const stockStore = useStockStore.getState();
        if (stockStore.matieres.length === 0) {
          await stockStore.chargerDonnees();
        }
        const matieres = useStockStore.getState().matieres;
        const matiereFarine = matieres.find(m => 
          m.nom.toLowerCase().includes('farine') && m.active
        ) || matieres.find(m => m.nom.toLowerCase().includes('farine'));

        if (matiereFarine) {
          // Quantité à déduire selon l'unité de stockage (kg, sac, sac_50kg)
          let quantiteADeduire = nbSacs;
          if (matiereFarine.unite === 'kg' || matiereFarine.unite === 'g') {
            quantiteADeduire = nbSacs * 50; // 50kg par sac standard
          }

          const dateProd = new Date(programmeActuel.dateProduction);
          const dateStr = dateProd.toLocaleDateString('fr-FR');

          await stockStore.addMouvement({
            matiereId: matiereFarine.id,
            quantite: quantiteADeduire,
            type: 'consommation',
            motif: `Production du ${dateStr} - ${nbSacs} sac(s) de farine pétri(s)`,
            auteur: 'Boulangerie',
            responsable: 'Chef Boulanger',
            referenceDocument: `PROD-${programmeActuel.id.slice(-6)}`,
            date: dateProd,
            userId: 'system'
          });
          console.log(`✅ ${quantiteADeduire} ${matiereFarine.unite} de farine déduit(s) pour ${nbSacs} sac(s)`);
        }
      }

      // Mettre à jour le statut du programme et enregistrer les sacs pétris
      const programmeValide = {
        ...programmeActuel,
        sacsFarinePetris: nbSacs > 0 ? nbSacs : programmeActuel.sacsFarinePetris,
        statut: 'produit' as const,
        updatedAt: new Date()
      };

      await firestoreService.update('productionPrograms', programmeActuel.id, {
        statut: 'produit',
        sacsFarinePetris: nbSacs > 0 ? nbSacs : (programmeActuel.sacsFarinePetris || 0),
        updatedAt: new Date()
      });

      set({
        programmeActuel: programmeValide,
        isLoading: false
      });

      console.log(`✅ Production validée avec ${nbSacs} sacs de farine pétris`);

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
    const { programmeActuel, commandesClients, quantitesBoutique } = get();
    if (!programmeActuel) return;

    try {
      const cmdsJour = commandesDuJour(commandesClients, programmeActuel.dateProduction);
      const cal = extraireDateCalendaire(programmeActuel.dateProduction);
      const dateProductionNorm = cal ? new Date(cal + 'T00:00:00.000Z') : new Date(programmeActuel.dateProduction);
      const calKey = cal || dateProductionNorm.toISOString().split('T')[0];

      const programmeEnvoye = {
        ...programmeActuel,
        commandesClients: cmdsJour,
        quantitesBoutique,
        dateProduction: dateProductionNorm,
        statut: 'envoye' as const,
        updatedAt: new Date()
      };

      // 1. Sauvegarder d'abord immédiatement dans le store
      set({ programmeActuel: programmeEnvoye, commandesClients: cmdsJour });
      get().calculerTotauxParProduit();

      // 2. Persister immédiatement dans le localStorage
      try {
        localStorage.setItem(`boulangerie_programme_${calKey}`, JSON.stringify(programmeEnvoye));
      } catch (_) {}

      // 3. Ajouter à la file d'attente de synchronisation
      addToSyncQueue({
        type: 'programme_production',
        data: {
          id: programmeEnvoye.id,
          data: cleanData({
            ...programmeEnvoye,
            dateProduction: dateToTimestamp(dateProductionNorm),
            dateCreation: dateToTimestamp(programmeEnvoye.dateCreation),
            createdAt: dateToTimestamp(programmeEnvoye.createdAt),
            updatedAt: dateToTimestamp(programmeEnvoye.updatedAt)
          })
        }
      });

      // 4. Puis déclencher la sauvegarde sans bloquer
      await get().sauvegarderProgramme();

    } catch (error) {
      console.warn('Envoi au boulanger traité en local:', error);
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

    set((state) => {
      const allCmds = [...state.commandesClients, nouvelleCommande];
      return {
        commandesClients: allCmds,
        programmeActuel: state.programmeActuel ? {
          ...state.programmeActuel,
          commandesClients: allCmds
        } : null
      };
    });

    get().marquerCommeModifie();
    get().calculerTotauxParProduit();
    get().declencherAutoSauvegarde();
  },

  ajouterCommandesClientsMultiples: (commandes) => {
    if (!commandes || commandes.length === 0) return;

    const nouvelles = commandes.map((c, idx) => ({
      ...c,
      id: `cmd_${Date.now()}_${idx}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    set((state) => {
      const allCmds = [...state.commandesClients, ...nouvelles];
      return {
        commandesClients: allCmds,
        programmeActuel: state.programmeActuel ? {
          ...state.programmeActuel,
          commandesClients: allCmds
        } : null
      };
    });

    get().marquerCommeModifie();
    get().calculerTotauxParProduit();
    get().declencherAutoSauvegarde();
  },

  modifierCommandeClient: (id, modifications) => {
    set((state) => {
      const newCmds = state.commandesClients.map(cmd =>
        cmd.id === id
          ? { ...cmd, ...modifications, updatedAt: new Date() }
          : cmd
      );
      return {
        commandesClients: newCmds,
        programmeActuel: state.programmeActuel ? {
          ...state.programmeActuel,
          commandesClients: newCmds
        } : null
      };
    });

    get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
    get().calculerTotauxParProduit();
    get().declencherAutoSauvegarde();
  },

  supprimerCommandeClient: (id) => {
    set((state) => {
      const newCmds = state.commandesClients.filter(cmd => cmd.id !== id);
      return {
        commandesClients: newCmds,
        programmeActuel: state.programmeActuel ? {
          ...state.programmeActuel,
          commandesClients: newCmds
        } : null
      };
    });

    get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
    get().calculerTotauxParProduit();
    get().declencherAutoSauvegarde();
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

  sauvegarderCommandeTypeWeekend: async (clientId, produits) => {
    try {
      // 1. Mise à jour Firestore
      await firestoreService.update('clients', clientId, {
        commandeTypeWeekend: produits,
        updatedAt: new Date()
      });

      // 2. Mise à jour état local
      set((state) => ({
        clients: state.clients.map(c =>
          c.id === clientId
            ? { ...c, commandeTypeWeekend: produits, updatedAt: new Date() }
            : c
        )
      }));

      console.log('✅ Commande type week-end sauvegardée pour client', clientId);
    } catch (error) {
      console.error('Erreur sauvegarde commande type week-end:', error);
      throw error;
    }
  },

  // Actions Quantités Boutique
  ajouterQuantiteBoutique: (quantite) => {
    set((state) => {
      const existingIndex = state.quantitesBoutique.findIndex(
        q => q.produitId === quantite.produitId
      );

      let newQuantites: QuantiteBoutique[];
      if (existingIndex >= 0) {
        newQuantites = [...state.quantitesBoutique];
        newQuantites[existingIndex] = quantite;
      } else {
        newQuantites = [...state.quantitesBoutique, quantite];
      }

      return {
        quantitesBoutique: newQuantites,
        programmeActuel: state.programmeActuel ? {
          ...state.programmeActuel,
          quantitesBoutique: newQuantites
        } : null
      };
    });
    get().marquerCommeModifie(); // Marquer comme modifié si déjà envoyé
    get().calculerTotauxParProduit();
    get().declencherAutoSauvegarde();
  },

  ajouterQuantitesBoutiqueMultiples: (quantites) => {
    if (!quantites || quantites.length === 0) return;

    set((state) => {
      const newQuantites = [...state.quantitesBoutique];
      quantites.forEach((quantite) => {
        const existingIndex = newQuantites.findIndex(q => q.produitId === quantite.produitId);
        if (existingIndex >= 0) {
          newQuantites[existingIndex] = quantite;
        } else {
          newQuantites.push(quantite);
        }
      });

      return {
        quantitesBoutique: newQuantites,
        programmeActuel: state.programmeActuel ? {
          ...state.programmeActuel,
          quantitesBoutique: newQuantites
        } : null
      };
    });
    get().marquerCommeModifie();
    get().calculerTotauxParProduit();
    get().declencherAutoSauvegarde();
  },

  modifierQuantiteBoutique: (produitId, quantite) => {
    set((state) => {
      const newQuantites = state.quantitesBoutique.map(q =>
        q.produitId === produitId
          ? { ...q, quantite }
          : q
      );
      return {
        quantitesBoutique: newQuantites,
        programmeActuel: state.programmeActuel ? {
          ...state.programmeActuel,
          quantitesBoutique: newQuantites
        } : null
      };
    });
    get().marquerCommeModifie();
    get().calculerTotauxParProduit();
    get().declencherAutoSauvegarde();
  },

  supprimerQuantiteBoutique: (produitId) => {
    set((state) => {
      const newQuantites = state.quantitesBoutique.filter(q => q.produitId !== produitId);
      return {
        quantitesBoutique: newQuantites,
        programmeActuel: state.programmeActuel ? {
          ...state.programmeActuel,
          quantitesBoutique: newQuantites
        } : null
      };
    });
    get().marquerCommeModifie();
    get().calculerTotauxParProduit();
    get().declencherAutoSauvegarde();
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
    get().declencherAutoSauvegarde();
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