import { create } from 'zustand';
import {
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Depense, CategorieDepense } from '../types';

interface DepenseStore {
    depenses: Depense[];
    isLoading: boolean;
    error: string | null;

    // Actions
    chargerDepenses: (dateDebut?: Date, dateFin?: Date) => Promise<void>;
    ajouterDepense: (depense: Omit<Depense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    supprimerDepense: (id: string) => Promise<void>;
    modifierDepense: (id: string, updates: Partial<Depense>) => Promise<void>;

    // Stats
    getTotalDepenses: () => number;
    getDepensesParCategorie: () => Record<CategorieDepense, number>;
}

export const useDepenseStore = create<DepenseStore>((set, get) => ({
    depenses: [],
    isLoading: false,
    error: null,

    chargerDepenses: async (dateDebut, dateFin) => {
        set({ isLoading: true, error: null });
        try {
            const depensesRef = collection(db, 'depenses');
            let q = query(depensesRef, orderBy('date', 'desc'));

            // Appliquer les filtres de date si fournis
            if (dateDebut) {
                q = query(q, where('date', '>=', dateDebut));
            }
            if (dateFin) {
                // Ajuster la fin de journée pour inclure toute la journée sélectionnée
                const adjustDateFin = new Date(dateFin);
                adjustDateFin.setHours(23, 59, 59, 999);
                q = query(q, where('date', '<=', adjustDateFin));
            }

            // Si aucune date n'est fournie, on charge le mois en cours par défaut pour éviter de tout charger
            if (!dateDebut && !dateFin) {
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);
                q = query(q, where('date', '>=', startOfMonth));
            }

            const snapshot = await getDocs(q);
            const depenses = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.date?.toDate() || new Date(),
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                } as Depense;
            });

            set({ depenses, isLoading: false });
        } catch (error) {
            console.error('Erreur chargement dépenses:', error);
            set({ error: 'Impossible de charger les dépenses', isLoading: false });
        }
    },

    ajouterDepense: async (nouveauRecu) => {
        set({ isLoading: true, error: null });
        try {
            const depenseData = {
                ...nouveauRecu,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                // Assurer que la date est stockée en Timestamp
                date: Timestamp.fromDate(nouveauRecu.date)
            };

            const docRef = await addDoc(collection(db, 'depenses'), depenseData);

            const nouvelleDepense: Depense = {
                ...nouveauRecu,
                id: docRef.id,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            set(state => ({
                depenses: [nouvelleDepense, ...state.depenses],
                isLoading: false
            }));
        } catch (error) {
            console.error('Erreur ajout dépense:', error);
            set({ error: 'Erreur lors de l\'ajout de la dépense', isLoading: false });
            throw error;
        }
    },

    supprimerDepense: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await deleteDoc(doc(db, 'depenses', id));
            set(state => ({
                depenses: state.depenses.filter(d => d.id !== id),
                isLoading: false
            }));
        } catch (error) {
            console.error('Erreur suppression dépense:', error);
            set({ error: 'Erreur lors de la suppression', isLoading: false });
            throw error;
        }
    },

    modifierDepense: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
            const docRef = doc(db, 'depenses', id);
            const updateData = {
                ...updates,
                updatedAt: Timestamp.now(),
                ...(updates.date ? { date: Timestamp.fromDate(updates.date) } : {})
            };

            await updateDoc(docRef, updateData);

            set(state => ({
                depenses: state.depenses.map(d =>
                    d.id === id
                        ? { ...d, ...updates, updatedAt: new Date() }
                        : d
                ),
                isLoading: false
            }));
        } catch (error) {
            console.error('Erreur modification dépense:', error);
            set({ error: 'Erreur lors de la modification', isLoading: false });
            throw error;
        }
    },

    getTotalDepenses: () => {
        return get().depenses.reduce((total, depense) => total + depense.montant, 0);
    },

    getDepensesParCategorie: () => {
        return get().depenses.reduce((acc, depense) => {
            acc[depense.categorie] = (acc[depense.categorie] || 0) + depense.montant;
            return acc;
        }, {} as Record<CategorieDepense, number>);
    }
}));
