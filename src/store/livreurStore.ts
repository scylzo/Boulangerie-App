import { create } from 'zustand';
import type { Livreur } from '../types';
import { firestoreService } from '../firebase/collections';
import { timestampToDate } from '../firebase/collections';
import type { Timestamp } from 'firebase/firestore';

interface LivreurStore {
  // État
  livreurs: Livreur[];
  livreurEnEdition: Livreur | null;
  isLoadingLivreurs: boolean;

  // Actions
  chargerLivreurs: () => Promise<void>;
  ajouterLivreur: (livreur: Omit<Livreur, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  modifierLivreur: (id: string, livreur: Partial<Livreur>) => Promise<void>;
  supprimerLivreur: (id: string) => Promise<void>;
  setLivreurEnEdition: (livreur: Livreur | null) => void;

  // Utilitaires
  getLivreurById: (id: string) => Livreur | undefined;
  getLivreursActifs: () => Livreur[];
}

export const useLivreurStore = create<LivreurStore>((set, get) => ({
  // État initial
  livreurs: [],
  livreurEnEdition: null,
  isLoadingLivreurs: false,

  // Actions
  chargerLivreurs: async () => {
    set({ isLoadingLivreurs: true });
    try {
      const livreurs = await firestoreService.getAll<any>('livreurs');
      const livreursConverts = livreurs.map(livreur => ({
        ...livreur,
        createdAt: livreur.createdAt instanceof Date ? livreur.createdAt : timestampToDate(livreur.createdAt as Timestamp),
        updatedAt: livreur.updatedAt instanceof Date ? livreur.updatedAt : timestampToDate(livreur.updatedAt as Timestamp),
      })) as Livreur[];

      set({ livreurs: livreursConverts, isLoadingLivreurs: false });
    } catch (error) {
      console.error('Erreur lors du chargement des livreurs:', error);
      set({ isLoadingLivreurs: false });
      throw error;
    }
  },

  ajouterLivreur: async (nouvelleDonnees) => {
    set({ isLoadingLivreurs: true });
    try {
      const maintenant = new Date();
      const nouveauLivreur: Omit<Livreur, 'id'> = {
        ...nouvelleDonnees,
        createdAt: maintenant,
        updatedAt: maintenant
      };

      const docRef = await firestoreService.create('livreurs', nouveauLivreur);
      const livreurCree: Livreur = {
        id: docRef.id,
        ...nouveauLivreur
      };

      set((state) => ({
        livreurs: [...state.livreurs, livreurCree],
        isLoadingLivreurs: false
      }));
    } catch (error) {
      console.error('Erreur lors de l\'ajout du livreur:', error);
      set({ isLoadingLivreurs: false });
      throw error;
    }
  },

  modifierLivreur: async (id, modifications) => {
    set({ isLoadingLivreurs: true });
    try {
      const donneesModifiees = {
        ...modifications,
        updatedAt: new Date()
      };

      await firestoreService.update('livreurs', id, donneesModifiees);

      set((state) => ({
        livreurs: state.livreurs.map(livreur =>
          livreur.id === id
            ? { ...livreur, ...donneesModifiees }
            : livreur
        ),
        isLoadingLivreurs: false,
        livreurEnEdition: null
      }));
    } catch (error) {
      console.error('Erreur lors de la modification du livreur:', error);
      set({ isLoadingLivreurs: false });
      throw error;
    }
  },

  supprimerLivreur: async (id) => {
    set({ isLoadingLivreurs: true });
    try {
      await firestoreService.delete('livreurs', id);

      set((state) => ({
        livreurs: state.livreurs.filter(livreur => livreur.id !== id),
        isLoadingLivreurs: false
      }));
    } catch (error) {
      console.error('Erreur lors de la suppression du livreur:', error);
      set({ isLoadingLivreurs: false });
      throw error;
    }
  },

  setLivreurEnEdition: (livreur) => {
    set({ livreurEnEdition: livreur });
  },

  // Utilitaires
  getLivreurById: (id: string) => {
    const { livreurs } = get();
    return livreurs.find(l => l.id === id);
  },

  getLivreursActifs: () => {
    const { livreurs } = get();
    return livreurs.filter(l => l.active);
  },
}));