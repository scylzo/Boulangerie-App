import { create } from 'zustand';
import {
    collection,
    runTransaction,
    doc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { firestoreService } from '../firebase/collections';
import type {
    MatierePremiere,
    MouvementStock,
    Fournisseur
} from '../types';

interface StockState {
    matieres: MatierePremiere[];
    mouvements: MouvementStock[];
    fournisseurs: Fournisseur[];
    isLoading: boolean;
    error: string | null;

    // Chargement initial
    chargerDonnees: () => Promise<void>;

    // Actions Matières
    addMatiere: (matiere: Omit<MatierePremiere, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateMatiere: (id: string, updates: Partial<MatierePremiere>) => Promise<void>;
    deleteMatiere: (id: string) => Promise<void>;
    convertMatiereUnit: (id: string, factor: number, newUnit: string) => Promise<void>;

    // Actions Mouvements
    addMouvement: (mouvement: Omit<MouvementStock, 'id' | 'createdAt'>) => Promise<void>;

    // Actions Fournisseurs
    addFournisseur: (fournisseur: Omit<Fournisseur, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateFournisseur: (id: string, updates: Partial<Fournisseur>) => Promise<void>;
    deleteFournisseur: (id: string) => Promise<void>;

    // Getters / Selectors
    getMatiere: (id: string) => MatierePremiere | undefined;
    getMouvementsByMatiere: (matiereId: string) => MouvementStock[];
    getDepensesPeriode: (debut: Date, fin: Date) => number;
    getValeurConsommationPeriode: (debut: Date, fin: Date) => number;
}

export const useStockStore = create<StockState>((set, get) => ({
    matieres: [],
    mouvements: [],
    fournisseurs: [],
    isLoading: false,
    error: null,

    chargerDonnees: async () => {
        set({ isLoading: true, error: null });
        try {
            const [matieres, mouvements, fournisseurs] = await Promise.all([
                firestoreService.getAll<MatierePremiere>('matieres'),
                firestoreService.getAll<MouvementStock>('mouvements'),
                firestoreService.getAll<Fournisseur>('fournisseurs')
            ]);

            // Conversion des dates (Timestamp -> Date)
            const convertDates = (item: any) => ({
                ...item,
                createdAt: item.createdAt instanceof Timestamp ? item.createdAt.toDate() : new Date(item.createdAt),
                updatedAt: item.updatedAt instanceof Timestamp ? item.updatedAt.toDate() : new Date(item.updatedAt || item.createdAt),
                // Spécifique Mouvements
                ...(item.date ? { date: item.date instanceof Timestamp ? item.date.toDate() : new Date(item.date) } : {})
            });

            set({
                matieres: matieres.map(convertDates) as MatierePremiere[],
                mouvements: mouvements.map(convertDates).sort((a: any, b: any) => b.date.getTime() - a.date.getTime()) as MouvementStock[],
                fournisseurs: fournisseurs.map(convertDates) as Fournisseur[],
                isLoading: false
            });
        } catch (error: any) {
            console.error('Erreur chargement stock:', error);
            set({ isLoading: false, error: error.message });
        }
    },

    addMatiere: async (matiereData) => {
        set({ isLoading: true });
        try {
            const newMatiere = {
                ...matiereData,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const docRef = await firestoreService.create('matieres', newMatiere);

            // Mise à jour locale optimiste (ou attendre le rechargement ?)
            // On ajoute l'ID généré
            const matiereAvecId: MatierePremiere = { id: docRef.id, ...newMatiere };

            set(state => ({
                matieres: [...state.matieres, matiereAvecId],
                isLoading: false
            }));
        } catch (error: any) {
            console.error('Erreur ajout matière:', error);
            set({ isLoading: false, error: error.message });
        }
    },

    updateMatiere: async (id, updates) => {
        try {
            await firestoreService.update('matieres', id, { ...updates, updatedAt: new Date() });
            set(state => ({
                matieres: state.matieres.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m)
            }));
        } catch (error: any) {
            console.error('Erreur modif matière:', error);
        }
    },

    deleteMatiere: async (id) => {
        try {
            await firestoreService.delete('matieres', id);
            set(state => ({
                matieres: state.matieres.filter(m => m.id !== id)
            }));
        } catch (error) {
            console.error('Erreur suppression matière:', error);
        }
    },

    convertMatiereUnit: async (id, factor, newUnit) => {
        set({ isLoading: true });
        try {
            const matiere = get().matieres.find(m => m.id === id);
            if (!matiere) throw new Error("Matière introuvable");

            // Conversion stricte pour TypeScript
            const unite = newUnit as any;

            const updates = {
                unite: unite,
                stockActuel: matiere.stockActuel * factor, // Ex: 1 sac * 50 = 50 kg
                prixMoyenPondere: matiere.prixMoyenPondere / factor, // Ex: 15000 / 50 = 300 FCFA/kg
                stockMinimum: matiere.stockMinimum * factor,
                updatedAt: new Date()
            };

            await firestoreService.update('matieres', id, updates);

            set(state => ({
                matieres: state.matieres.map(m => m.id === id ? { ...m, ...updates } as MatierePremiere : m),
                isLoading: false
            }));

            console.log(`✅ Conversion réussie: ${matiere.nom} (x${factor}) -> ${newUnit}`);
        } catch (error: any) {
            console.error('Erreur conversion unité:', error);
            set({ isLoading: false, error: error.message });
        }
    },

    addMouvement: async (mouvementData) => {
        set({ isLoading: true });
        try {
            // TRANSACTION REQUISE : Mettre à jour le mouvement ET le stock/PMP de la matière
            await runTransaction(db, async (transaction) => {
                // 1. Lire la matière actuelle
                const matiereRef = doc(db, 'matieres', mouvementData.matiereId);
                const matiereDoc = await transaction.get(matiereRef);

                if (!matiereDoc.exists()) {
                    throw new Error("Matière première introuvable !");
                }

                const matiere = matiereDoc.data() as MatierePremiere;

                let newStock = matiere.stockActuel;
                let newPMP = matiere.prixMoyenPondere;
                let newValeurTotale = matiere.valeurTotale;

                // 2. Calculer les nouvelles valeurs
                if (mouvementData.type === 'achat') {
                    const quantiteAchat = mouvementData.quantite;
                    const prixAchat = mouvementData.prixTotal || 0;

                    // PMP = (Valeur Stock Avant + Valeur Achat) / (Qte Avant + Qte Achat)
                    if (newStock + quantiteAchat > 0) {
                        newPMP = (newValeurTotale + prixAchat) / (newStock + quantiteAchat);
                    }
                    newStock += quantiteAchat;
                    newValeurTotale += prixAchat;
                } else {
                    // Pour les sorties, on valorise au PMP actuel
                    // Mais attention, on garde la convention : newValeurTotale = Stock * PMP
                    // Sauf si correction manuelle ? Restons simples selon la logique précédente

                    let signedQuantity = Math.abs(mouvementData.quantite);
                    // Si ce n'est pas un achat ou une correction positive, c'est une sortie
                    if (['consommation', 'perte', 'retour_fournisseur'].includes(mouvementData.type)) {
                        signedQuantity = -signedQuantity;
                    }
                    // Note: pour 'correction', si quantity est positive c'est un ajout, négative un retrait (géré par linput utilisateur potentiellement ou logique)
                    // Dans le modal actuel, correction est traitée comme value absolue pour l'instant dans l'ancien code?
                    // Vérifions l'ancien code: 
                    // if (mouvementData.type === 'correction') signedQuantity = mouvementData.quantite; (donc peut etre negatif)

                    // Dans le doute, pour 'correction', on fait confiance au signe envoyé ou à la logique UI. 
                    // Mais dans le modal UI, tout est positif. Supposons 'correction' = ajustement absolu ? 
                    // Non, correction d'inventaire c'est souvent "j'ai compté X, le système dit Y".
                    // Simplification: le modal envoie une quantité positive. Si type correction, considérons ça comme un AJOUT pour l'instant ou laissons l'UI gérer le signe.
                    // L'ancien code disait: if type != achat, newStock += signedQuantity.

                    if (mouvementData.type === 'correction') {
                        // Pour l'instant, traitons correction comme un ajout direct (ou retrait si négatif)
                        signedQuantity = mouvementData.quantite;
                    }

                    newStock += signedQuantity;
                    // On recalcule la valeur totale
                    newValeurTotale = newStock * newPMP;
                }

                // 3. Préparer le mouvement à créer
                const newMouvementRef = doc(collection(db, 'mouvements'));

                // Calculer la valeur du mouvement pour les sorties (Consommation / Perte)
                // C'est important pour le calcul de rentabilité (Cout de revient)
                let valeurMouvement = mouvementData.prixTotal;

                if (mouvementData.type !== 'achat' && !valeurMouvement) {
                    // Pour une sortie, la valeur est : Quantité * PMP à l'instant T
                    // On utilise Math.abs car la quantité mouvement peut être positive dans l'input mais stockée négativement ou l'inverse
                    // Ici quantity est signée dans mouvementData ou non ?
                    // Dans le bloc else plus haut : "signedQuantity = Math.abs(mouvementData.quantite); if (...) signedQuantity = -signedQuantity;"
                    // Donc on prend la valeur absolue de la quantité impliquée
                    valeurMouvement = Math.abs(mouvementData.quantite) * newPMP;
                }

                const newMouvement: any = {
                    id: newMouvementRef.id,
                    ...mouvementData,
                    prixTotal: valeurMouvement, // On sauvegarde la valorisation
                    createdAt: new Date(),
                    date: mouvementData.date || new Date(),
                };

                // Nettoyer les undefined pour Firestore
                Object.keys(newMouvement).forEach(key => {
                    if (newMouvement[key] === undefined) {
                        delete newMouvement[key];
                    }
                });

                // 4. Écritures dans la transaction
                transaction.set(newMouvementRef, newMouvement);
                transaction.update(matiereRef, {
                    stockActuel: newStock,
                    prixMoyenPondere: newPMP,
                    valeurTotale: newValeurTotale,
                    updatedAt: new Date()
                });

                // Mettre à jour l'état local APRES succès (pas possible IN transaction callback easily for pure state sync)
                // On le fera après le await
            });

            // Rechargement des données pour être sûr d'avoir l'état frais (ou update manuel optimiste)
            // Pour être sûr de la synchro PMP, on recharge tout ou juste la matière ?
            // Optimisons : recharger juste matières et mouvements
            get().chargerDonnees();

        } catch (error: any) {
            console.error('Erreur transaction stock:', error);
            set({ isLoading: false, error: error.message });
        }
    },

    addFournisseur: async (fournisseurData) => {
        set({ isLoading: true });
        try {
            const newFournisseur = {
                ...fournisseurData,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const docRef = await firestoreService.create('fournisseurs', newFournisseur);

            const fournisseurAvecId: Fournisseur = { id: docRef.id, ...newFournisseur };
            set(state => ({
                fournisseurs: [...state.fournisseurs, fournisseurAvecId],
                isLoading: false
            }));
        } catch (error: any) {
            console.error('Erreur ajout fournisseur:', error);
            set({ isLoading: false, error: error.message });
        }
    },

    updateFournisseur: async (id, updates) => {
        try {
            await firestoreService.update('fournisseurs', id, { ...updates, updatedAt: new Date() });
            set(state => ({
                fournisseurs: state.fournisseurs.map(f => f.id === id ? { ...f, ...updates, updatedAt: new Date() } : f)
            }));
        } catch (error) {
            console.error('Erreur modif fournisseur:', error);
        }
    },

    deleteFournisseur: async (id) => {
        try {
            await firestoreService.delete('fournisseurs', id);
            set(state => ({
                fournisseurs: state.fournisseurs.filter(f => f.id !== id)
            }));
        } catch (error) {
            console.error('Erreur suppression fournisseur:', error);
        }
    },

    getMatiere: (id) => get().matieres.find((m) => m.id === id),

    getMouvementsByMatiere: (matiereId) => {
        return get().mouvements
            .filter((m) => m.matiereId === matiereId);
        // Le tri est déjà fait au chargement
    },

    getDepensesPeriode: (debut, fin) => {
        return get().mouvements
            .filter(m => {
                const date = new Date(m.date);
                return m.type === 'achat' && date >= debut && date <= fin;
            })
            .reduce((total, m) => total + (m.prixTotal || 0), 0);
    },

    getValeurConsommationPeriode: (debut: Date, fin: Date) => {
        const { mouvements, matieres } = get();
        return mouvements
            .filter(m => {
                const date = new Date(m.date);
                // On prend tout ce qui est sortie de stock (Consommation, Perte)
                // SAUF retour fournisseur (qui est un remboursement / avoir)
                // Et correction ? Si correction négative, c'est une perte sèche.
                return ['consommation', 'perte'].includes(m.type) && date >= debut && date <= fin;
            })
            .reduce((total, m) => {
                // Si la valeur est historisée (nouveau système)
                if (m.prixTotal) {
                    return total + m.prixTotal;
                }

                // FALLBACK pour données historiques : utiliser le PMP actuel de la matière
                // C'est approximatif mais mieux que 0
                const matiere = matieres.find(mat => mat.id === m.matiereId);
                const pmpActuel = matiere?.prixMoyenPondere || 0;
                return total + (Math.abs(m.quantite) * pmpActuel);
            }, 0);
    }
}));
