import { create } from 'zustand';
import type { Produit, Client } from '../types';
import { firestoreService } from '../firebase/collections';
import { produitsInitiaux, clientsInitiaux } from '../data/produits-initiaux';

interface ReferentielStore {
  // État Produits
  produits: Produit[];
  produitEnEdition: Produit | null;
  isLoadingProduits: boolean;

  // État Clients
  clients: Client[];
  clientEnEdition: Client | null;
  isLoadingClients: boolean;

  // Actions Produits
  chargerProduits: () => Promise<void>;
  ajouterProduit: (produit: Omit<Produit, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  modifierProduit: (id: string, produit: Partial<Produit>) => Promise<void>;
  supprimerProduit: (id: string) => Promise<void>;
  setProduitEnEdition: (produit: Produit | null) => void;

  // Actions Clients
  chargerClients: () => Promise<void>;
  ajouterClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  modifierClient: (id: string, client: Partial<Client>) => Promise<void>;
  supprimerClient: (id: string) => Promise<void>;
  setClientEnEdition: (client: Client | null) => void;

  // Utilitaires
  getProduitById: (id: string) => Produit | undefined;
  getClientById: (id: string) => Client | undefined;
  getProduitsActifs: () => Produit[];
  getClientsActifs: () => Client[];

  // Actions d'initialisation
  initialiserProduitsParDefaut: () => Promise<void>;
  initialiserClientsParDefaut: () => Promise<void>;
}

export const useReferentielStore = create<ReferentielStore>((set, get) => ({
  // État initial
  produits: [],
  produitEnEdition: null,
  isLoadingProduits: false,
  clients: [],
  clientEnEdition: null,
  isLoadingClients: false,

  // Actions Produits
  chargerProduits: async () => {
    set({ isLoadingProduits: true });
    try {
      const produits = await firestoreService.getAll<Produit>('produits');
      set({ produits, isLoadingProduits: false });
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      set({ isLoadingProduits: false });
      throw error;
    }
  },

  ajouterProduit: async (nouvelleDonnees) => {
    set({ isLoadingProduits: true });
    try {
      const maintenant = new Date();
      const nouveauProduit: Omit<Produit, 'id'> = {
        ...nouvelleDonnees,
        createdAt: maintenant,
        updatedAt: maintenant
      };

      const docRef = await firestoreService.create('produits', nouveauProduit);
      const produitCree: Produit = {
        id: docRef.id,
        ...nouveauProduit
      };

      set((state) => ({
        produits: [...state.produits, produitCree],
        isLoadingProduits: false
      }));
    } catch (error) {
      console.error('Erreur lors de l\'ajout du produit:', error);
      set({ isLoadingProduits: false });
      throw error;
    }
  },

  modifierProduit: async (id, modifications) => {
    set({ isLoadingProduits: true });
    try {
      const donneesModifiees = {
        ...modifications,
        updatedAt: new Date()
      };

      await firestoreService.update('produits', id, donneesModifiees);

      set((state) => ({
        produits: state.produits.map(produit =>
          produit.id === id
            ? { ...produit, ...donneesModifiees }
            : produit
        ),
        isLoadingProduits: false,
        produitEnEdition: null
      }));
    } catch (error) {
      console.error('Erreur lors de la modification du produit:', error);
      set({ isLoadingProduits: false });
      throw error;
    }
  },

  supprimerProduit: async (id) => {
    set({ isLoadingProduits: true });
    try {
      await firestoreService.delete('produits', id);

      set((state) => ({
        produits: state.produits.filter(produit => produit.id !== id),
        isLoadingProduits: false
      }));
    } catch (error) {
      console.error('Erreur lors de la suppression du produit:', error);
      set({ isLoadingProduits: false });
      throw error;
    }
  },

  setProduitEnEdition: (produit) => {
    set({ produitEnEdition: produit });
  },

  // Actions Clients
  chargerClients: async () => {
    set({ isLoadingClients: true });
    try {
      const clients = await firestoreService.getAll<Client>('clients');
      set({ clients, isLoadingClients: false });
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
      set({ isLoadingClients: false });
      throw error;
    }
  },

  ajouterClient: async (nouvelleDonnees) => {
    set({ isLoadingClients: true });
    try {
      const maintenant = new Date();
      const nouveauClient: Omit<Client, 'id'> = {
        ...nouvelleDonnees,
        createdAt: maintenant,
        updatedAt: maintenant
      };

      const docRef = await firestoreService.create('clients', nouveauClient);
      const clientCree: Client = {
        id: docRef.id,
        ...nouveauClient
      };

      set((state) => ({
        clients: [...state.clients, clientCree],
        isLoadingClients: false
      }));
    } catch (error) {
      console.error('Erreur lors de l\'ajout du client:', error);
      set({ isLoadingClients: false });
      throw error;
    }
  },

  modifierClient: async (id, modifications) => {
    set({ isLoadingClients: true });
    try {
      const donneesModifiees = {
        ...modifications,
        updatedAt: new Date()
      };

      await firestoreService.update('clients', id, donneesModifiees);

      set((state) => ({
        clients: state.clients.map(client =>
          client.id === id
            ? { ...client, ...donneesModifiees }
            : client
        ),
        isLoadingClients: false,
        clientEnEdition: null
      }));
    } catch (error) {
      console.error('Erreur lors de la modification du client:', error);
      set({ isLoadingClients: false });
      throw error;
    }
  },

  supprimerClient: async (id) => {
    set({ isLoadingClients: true });
    try {
      await firestoreService.delete('clients', id);

      set((state) => ({
        clients: state.clients.filter(client => client.id !== id),
        isLoadingClients: false
      }));
    } catch (error) {
      console.error('Erreur lors de la suppression du client:', error);
      set({ isLoadingClients: false });
      throw error;
    }
  },

  setClientEnEdition: (client) => {
    set({ clientEnEdition: client });
  },

  // Utilitaires
  getProduitById: (id: string) => {
    const { produits } = get();
    return produits.find(p => p.id === id);
  },

  getClientById: (id: string) => {
    const { clients } = get();
    return clients.find(c => c.id === id);
  },

  getProduitsActifs: () => {
    const { produits } = get();
    return produits.filter(p => p.active);
  },

  getClientsActifs: () => {
    const { clients } = get();
    return clients.filter(c => c.active);
  },

  // Actions d'initialisation
  initialiserProduitsParDefaut: async () => {
    console.log('⚠️ Initialisation automatique désactivée - charger manuellement les produits');
    await get().chargerProduits();
  },

  initialiserClientsParDefaut: async () => {
    console.log('⚠️ Initialisation automatique désactivée - charger manuellement les clients');
    await get().chargerClients();
  },
}));