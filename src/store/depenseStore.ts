import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
    getDepensesProRata: (dateDebut: Date, dateFin: Date) => { total: number; parCategorie: Record<CategorieDepense, number> };
}

export const useDepenseStore = create<DepenseStore>()(
    persist(
        (set, get) => ({
            depenses: [],
            isLoading: false,
            error: null,

            chargerDepenses: async (dateDebut, dateFin) => {
                set({ isLoading: true, error: null });
                try {
                    const depensesRef = collection(db, 'depenses');
                    const promises = [];

                    // Requete 1 : Dépenses par date de paiement (Range standard)
                    let q1 = query(depensesRef, orderBy('date', 'desc'));

                    // Si aucune date n'est fournie, on charge le mois en cours par défaut
                    let startFilter = dateDebut;
                    let endFilter = dateFin;

                    if (!startFilter && !endFilter) {
                        const now = new Date();
                        startFilter = new Date(now.getFullYear(), now.getMonth(), 1);
                        startFilter.setHours(0, 0, 0, 0);
                    }

                    if (startFilter) {
                        q1 = query(q1, where('date', '>=', startFilter));
                    }
                    if (endFilter) {
                        const adjustDateFin = new Date(endFilter);
                        adjustDateFin.setHours(23, 59, 59, 999);
                        q1 = query(q1, where('date', '<=', adjustDateFin));
                    }
                    promises.push(getDocs(q1));

                    // Requete 2 : Dépenses avec période d'usage qui chevauchent le début de la période
                    // On cherche les dépenses dont dateFinUsage >= dateDebut
                    if (startFilter) {
                        const q2 = query(depensesRef, where('dateFinUsage', '>=', startFilter));
                        promises.push(getDocs(q2));
                    }

                    const snapshots = await Promise.all(promises);
                    const allDocs = new Map();

                    snapshots.forEach(snapshot => {
                        snapshot.docs.forEach(doc => {
                            allDocs.set(doc.id, doc);
                        });
                    });

                    const depenses = Array.from(allDocs.values()).map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            date: data.date?.toDate() || new Date(),
                            dateDebutUsage: data.dateDebutUsage?.toDate(),
                            dateFinUsage: data.dateFinUsage?.toDate(),
                            createdAt: data.createdAt?.toDate() || new Date(),
                            updatedAt: data.updatedAt?.toDate() || new Date(),
                        } as Depense;
                    });

                    // Tri final par date
                    depenses.sort((a, b) => b.date.getTime() - a.date.getTime());

                    set({ depenses, isLoading: false });
                } catch (error) {
                    console.error('Erreur chargement dépenses:', error);
                    set({ error: 'Impossible de charger les dépenses', isLoading: false });
                }
            },

            ajouterDepense: async (nouveauRecu) => {
                set({ isLoading: true, error: null });
                try {
                    // Préparer les données en excluant les champs undefined
                    const depenseData: any = {
                        ...nouveauRecu,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                        date: Timestamp.fromDate(nouveauRecu.date),
                    };

                    // Conversion explicite et nettoyage des champs optionnels
                    if (nouveauRecu.dateDebutUsage) {
                        depenseData.dateDebutUsage = Timestamp.fromDate(nouveauRecu.dateDebutUsage);
                    } else {
                        delete depenseData.dateDebutUsage;
                    }

                    if (nouveauRecu.dateFinUsage) {
                        depenseData.dateFinUsage = Timestamp.fromDate(nouveauRecu.dateFinUsage);
                    } else {
                        delete depenseData.dateFinUsage;
                    }

                    if (depenseData.fournisseur === undefined) {
                        delete depenseData.fournisseur;
                    }

                    // Nettoyage générique final pour sécurité
                    Object.keys(depenseData).forEach(key =>
                        depenseData[key] === undefined && delete depenseData[key]
                    );

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
                    const updateData: any = {
                        ...updates,
                        updatedAt: Timestamp.now()
                    };

                    if (updates.date) updateData.date = Timestamp.fromDate(updates.date);
                    if (updates.dateDebutUsage) updateData.dateDebutUsage = Timestamp.fromDate(updates.dateDebutUsage);
                    if (updates.dateFinUsage) updateData.dateFinUsage = Timestamp.fromDate(updates.dateFinUsage);

                    // Nettoyage générique
                    Object.keys(updateData).forEach(key =>
                        updateData[key] === undefined && delete updateData[key]
                    );

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
            },

            getDepensesProRata: (dateDebut: Date, dateFin: Date) => {
                // Cette fonction calcule le montant "réellement consommé" sur la période donnée
                // Si la dépense a une période d'usage définie, on applique un prorata temporis

                const depenses = get().depenses;
                const result = {
                    total: 0,
                    parCategorie: {} as Record<CategorieDepense, number>
                };

                // Normaliser les dates de filtre (début de journée / fin de journée)
                const startFilter = new Date(dateDebut);
                startFilter.setHours(0, 0, 0, 0);
                const endFilter = new Date(dateFin);
                endFilter.setHours(23, 59, 59, 999);

                depenses.forEach(depense => {
                    let montantACompter = 0;

                    if (depense.dateDebutUsage && depense.dateFinUsage) {
                        // Cas avec période d'usage (ex: Carburant acheté le 4 Nov utilisé jusqu'au 19 Dec)
                        const usageStart = new Date(depense.dateDebutUsage);
                        usageStart.setHours(0, 0, 0, 0);
                        const usageEnd = new Date(depense.dateFinUsage);
                        usageEnd.setHours(23, 59, 59, 999);

                        // Vérifier s'il y a chevauchement avec la période filtrée
                        if (usageStart <= endFilter && usageEnd >= startFilter) {
                            // Calculer la durée totale d'usage en jours (inclusive)
                            const MS_PER_DAY = 1000 * 60 * 60 * 24;

                            // On normalise strictement à midi pour éviter les pépins de changement d'heure ou de ms
                            const startU = new Date(usageStart); startU.setHours(12, 0, 0, 0);
                            const endU = new Date(usageEnd); endU.setHours(12, 0, 0, 0);

                            // Durée totale en jours = diff + 1
                            const totalDurationDays = Math.round((endU.getTime() - startU.getTime()) / MS_PER_DAY) + 1;

                            const coutParJour = depense.montant / Math.max(1, totalDurationDays);

                            // Calculer le chevauchement (overlap)
                            // On normalise les filtres aussi
                            const startF = new Date(startFilter); startF.setHours(12, 0, 0, 0);
                            const endF = new Date(endFilter); endF.setHours(12, 0, 0, 0);

                            const overlapStartStrict = startU > startF ? startU : startF;
                            const overlapEndStrict = endU < endF ? endU : endF;

                            let overlapDays = 0;
                            if (overlapEndStrict >= overlapStartStrict) {
                                overlapDays = Math.round((overlapEndStrict.getTime() - overlapStartStrict.getTime()) / MS_PER_DAY) + 1;
                            }

                            montantACompter = coutParJour * overlapDays;
                        }
                    } else {
                        // Cas standard (Date de paiement)
                        const depenseDate = new Date(depense.date);
                        if (depenseDate >= startFilter && depenseDate <= endFilter) {
                            montantACompter = depense.montant;
                        }
                    }

                    if (montantACompter > 0) {
                        result.total += montantACompter;
                        result.parCategorie[depense.categorie] = (result.parCategorie[depense.categorie] || 0) + montantACompter;
                    }
                });

                return result;
            }
        }),
        {
            name: 'depenses-storage',
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name);
                    if (!str) return null;
                    return JSON.parse(str, (value) => {
                        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
                            return new Date(value);
                        }
                        return value;
                    });
                },
                setItem: (name, value) => {
                    localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => localStorage.removeItem(name),
            },
            partialize: (state) => ({
                depenses: state.depenses,
            }) as unknown as DepenseStore,
        }
    )
);
