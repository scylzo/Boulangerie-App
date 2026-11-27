import { create } from 'zustand';
import toast from 'react-hot-toast';
import {
    runTransaction,
    doc,
    Timestamp,
    orderBy,
    limit
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { firestoreService } from '../firebase/collections';
import { memeJour } from '../utils/dateUtils';
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
    addMatiere: (matiere: Omit<MatierePremiere, 'id' | 'updatedAt'>) => Promise<void>;
    updateMatiere: (id: string, updates: Partial<MatierePremiere>) => Promise<void>;
    deleteMatiere: (id: string) => Promise<void>;
    convertMatiereUnit: (id: string, factor: number, newUnit: string) => Promise<void>;

    // Actions Mouvements
    addMouvement: (mouvement: Omit<MouvementStock, 'id' | 'createdAt'>) => Promise<void>;

    // Actions Fournisseurs
    addFournisseur: (fournisseur: Omit<Fournisseur, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateFournisseur: (id: string, updates: Partial<Fournisseur>) => Promise<void>;
    deleteFournisseur: (id: string) => Promise<void>;

    // Actions Spécifiques
    declarerConsommationJournee: (date: Date, consommations: { matiereId: string, quantite: number, motif?: string }[]) => Promise<void>;
    declarerConsommationPeriode: (
        dateDebut: Date,
        dateFin: Date,
        consommations: { matiereId: string, quantiteParJour: number, motif?: string }[],
        options?: { exclureDimanches?: boolean; ecraserExistant?: boolean }
    ) => Promise<{ nbJours: number; nbMouvements: number }>;
    deleteMouvement: (id: string) => Promise<void>;
    updateMouvement: (id: string, updates: Partial<MouvementStock>) => Promise<void>;

    // Getters / Selectors
    getMatiere: (id: string) => MatierePremiere | undefined;
    getMouvementsByMatiere: (matiereId: string) => MouvementStock[];

    // Utilitaire de réparation
    reparerHistoriqueStock: () => Promise<void>;
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
                firestoreService.getByQuery<MouvementStock>('mouvements', [
                    orderBy('createdAt', 'desc'),
                    limit(150)
                ]).catch(() => firestoreService.getByQuery<MouvementStock>('mouvements', [limit(150)])),
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
                matieres: matieres.map(convertDates).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()) as MatierePremiere[],
                mouvements: mouvements.map(convertDates).sort((a: any, b: any) => {
                    const dateDiff = b.date.getTime() - a.date.getTime();
                    if (dateDiff !== 0) return dateDiff;
                    return b.createdAt.getTime() - a.createdAt.getTime();
                }) as MouvementStock[],
                fournisseurs: fournisseurs.map(convertDates) as Fournisseur[],
                isLoading: false
            });
        } catch (error: any) {
            console.error('Erreur chargement stock:', error);
            set({ isLoading: false, error: error.message });
            if (error?.code === 'resource-exhausted') {
                console.warn('Quota Firestore atteint pour le chargement des stocks.');
            }
        }
    },

    addMatiere: async (matiereData) => {
        set({ isLoading: true });
        try {
            const newMatiere = {
                ...matiereData,
                createdAt: matiereData.createdAt || new Date(),
                updatedAt: new Date()
            };
            const docRef = await firestoreService.create('matieres', newMatiere);

            // Mise à jour locale optimiste (ou attendre le rechargement ?)
            // On ajoute l'ID généré
            const matiereAvecId: MatierePremiere = { id: docRef.id, ...newMatiere };

            set(state => ({
                matieres: [matiereAvecId, ...state.matieres],
                isLoading: false
            }));
            toast.success("Matière ajoutée avec succès !");
        } catch (error: any) {
            console.error('Erreur ajout matière:', error);
            set({ isLoading: false, error: error.message });
            toast.error("Erreur lors de l'ajout de la matière.");
        }
    },

    updateMatiere: async (id, updates) => {
        try {
            await firestoreService.update('matieres', id, { ...updates, updatedAt: new Date() });
            set(state => ({
                matieres: state.matieres.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m)
            }));
            toast.success("Matière mise à jour avec succès !");
        } catch (error: any) {
            console.error('Erreur modif matière:', error);
            toast.error("Erreur lors de la mise à jour.");
        }
    },

    deleteMatiere: async (id) => {
        try {
            await firestoreService.delete('matieres', id);
            set(state => ({
                matieres: state.matieres.filter(m => m.id !== id)
            }));
            toast.success("Matière supprimée.");
        } catch (error) {
            console.error('Erreur suppression matière:', error);
            toast.error("Erreur lors de la suppression.");
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
                stockActuel: Math.round((matiere.stockActuel * factor + Number.EPSILON) * 100) / 100, // Ex: 1 sac * 50 = 50 kg
                stockMinimum: Math.round((matiere.stockMinimum * factor + Number.EPSILON) * 100) / 100,
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
            const matieres = get().matieres;
            const matiere = matieres.find(m => m.id === mouvementData.matiereId);
            const currentStock = Number(matiere?.stockActuel ?? 0);
            const currentPMP = Number(matiere?.prixUnitaireMoyen ?? 0);

            let newStock = currentStock;
            let newPMP = currentPMP;

            if (mouvementData.type === 'achat') {
                const quantiteAchat = Number(mouvementData.quantite || 0);
                const prixAchat = Number(mouvementData.prixUnitaire || 0);

                if (prixAchat > 0) {
                    const ancienStockVal = Math.max(0, currentStock) * currentPMP;
                    const nouvelAchatVal = quantiteAchat * prixAchat;
                    const stockTotalTheorique = Math.max(0, currentStock) + quantiteAchat;

                    if (stockTotalTheorique > 0) {
                        newPMP = (ancienStockVal + nouvelAchatVal) / stockTotalTheorique;
                    } else {
                        newPMP = prixAchat;
                    }
                } else if (currentPMP === 0 && prixAchat > 0) {
                    newPMP = prixAchat;
                }

                newStock += quantiteAchat;
            } else if (mouvementData.type === 'correction') {
                // Dans le cas d'une correction, quantite est le delta signé (+ ou -)
                const delta = Number(mouvementData.quantite || 0);
                newStock += delta;
            } else {
                // Sorties (consommation, perte, retour_fournisseur)
                const sortie = Math.abs(Number(mouvementData.quantite || 0));
                newStock -= sortie;
            }

            const finalStock = Math.round((newStock + Number.EPSILON) * 100) / 100;
            const finalPMP = Math.round((newPMP + Number.EPSILON) * 100) / 100;

            const dateMouv = mouvementData.date 
                ? (mouvementData.date instanceof Date ? mouvementData.date : new Date(mouvementData.date)) 
                : new Date();
            const now = new Date();

            const tempMouvementId = `mouv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const localMouvement: MouvementStock = {
                id: tempMouvementId,
                ...mouvementData,
                quantite: Number(mouvementData.quantite || 0),
                prixUnitaire: mouvementData.prixUnitaire ? Number(mouvementData.prixUnitaire) : undefined,
                date: dateMouv,
                createdAt: now
            };

            // 1. MISE À JOUR IMMÉDIATE (0ms) DANS LE STORE ZUSTAND
            set(state => ({
                matieres: state.matieres.map(m => m.id === mouvementData.matiereId ? {
                    ...m,
                    stockActuel: finalStock,
                    prixUnitaireMoyen: finalPMP,
                    updatedAt: now
                } : m),
                mouvements: [localMouvement, ...state.mouvements],
                isLoading: false
            }));

            // 2. PERSISTANCE FIRESTORE SÉCURISÉE
            const updateMatierePromise = firestoreService.update('matieres', mouvementData.matiereId, {
                stockActuel: finalStock,
                prixUnitaireMoyen: finalPMP,
                updatedAt: now
            });

            const createMouvPromise = firestoreService.create('mouvements', {
                ...mouvementData,
                quantite: Number(mouvementData.quantite || 0),
                prixUnitaire: mouvementData.prixUnitaire ? Number(mouvementData.prixUnitaire) : undefined,
                date: dateMouv,
                createdAt: now
            });

            const [_, mouvDocRef] = await Promise.all([updateMatierePromise, createMouvPromise]);

            if (mouvDocRef?.id) {
                // Remplacer l'id temporaire par l'id réel de Firestore
                set(state => ({
                    mouvements: state.mouvements.map(m => m.id === tempMouvementId ? { ...m, id: mouvDocRef.id } : m)
                }));
            }

        } catch (error: any) {
            console.error('Erreur addMouvement stock:', error);
            set({ isLoading: false, error: error.message });
            throw error;
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

    declarerConsommationJournee: async (date: Date, consommations: { id?: string, matiereId: string, quantite: number, motif?: string }[]) => {
        set({ isLoading: true });
        try {
            console.log(`📝 Déclaration/Mise à jour consommation pour ${date.toLocaleDateString()}:`, consommations.length, 'matières');

            for (const conso of consommations) {
                if (conso.id) {
                    // MISE À JOUR d'une consommation existante
                    await get().updateMouvement(conso.id, {
                        quantite: conso.quantite,
                        motif: conso.motif || 'Mise à jour consommation journalière',
                        date: date
                    });
                } else if (conso.quantite > 0) {
                    // CRÉATION d'une nouvelle consommation
                    await get().addMouvement({
                        matiereId: conso.matiereId,
                        quantite: conso.quantite,
                        type: 'consommation',
                        motif: conso.motif || 'Déclaration journalière',
                        auteur: 'Système', 
                        responsable: 'Responsable Prod',
                        referenceDocument: `DECL-${date.toLocaleDateString('fr-CA')}`,
                        date: date,
                        userId: 'system'
                    });
                }
            }

            set({ isLoading: false });
            console.log('✅ Opération consommations terminée');

        } catch (error: any) {
            console.error('Erreur déclaration consommation:', error);
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    declarerConsommationPeriode: async (
        dateDebut: Date,
        dateFin: Date,
        consommations: { matiereId: string, quantiteParJour: number, motif?: string }[],
        options: { exclureDimanches?: boolean; ecraserExistant?: boolean } = {}
    ) => {
        set({ isLoading: true });
        try {
            const { exclureDimanches = true, ecraserExistant = true } = options;

            const debut = new Date(dateDebut);
            debut.setHours(0, 0, 0, 0);
            const fin = new Date(dateFin);
            fin.setHours(23, 59, 59, 999);

            if (debut.getTime() > fin.getTime()) {
                throw new Error("La date de début doit être antérieure ou égale à la date de fin.");
            }

            // Générer la liste des jours calendaires
            const datesJours: Date[] = [];
            const cur = new Date(debut);
            while (cur <= fin) {
                if (!exclureDimanches || cur.getDay() !== 0) {
                    datesJours.push(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 12, 0, 0));
                }
                cur.setDate(cur.getDate() + 1);
            }

            if (datesJours.length === 0) {
                throw new Error("Aucune journée de production éligible sur cette période.");
            }

            const consosValides = consommations.filter(c => Number(c.quantiteParJour) > 0);
            if (consosValides.length === 0) {
                throw new Error("Veuillez saisir au moins une matière avec une quantité positive.");
            }

            console.log(`📝 Déclaration consommation période (${datesJours.length} jours) pour ${consosValides.length} matières`);

            let nbMouvementsTraites = 0;

            for (const jour of datesJours) {
                const payloadJour: { id?: string, matiereId: string, quantite: number, motif?: string }[] = [];

                for (const c of consosValides) {
                    const qte = Number(c.quantiteParJour);
                    const mvtExistant = get().mouvements.find(m =>
                        m.type === 'consommation' &&
                        m.matiereId === c.matiereId &&
                        memeJour(new Date(m.date), jour)
                    );

                    if (mvtExistant) {
                        if (ecraserExistant) {
                            payloadJour.push({
                                id: mvtExistant.id,
                                matiereId: c.matiereId,
                                quantite: qte,
                                motif: c.motif || `Consommation journalière (${qte})`
                            });
                            nbMouvementsTraites++;
                        }
                    } else {
                        payloadJour.push({
                            matiereId: c.matiereId,
                            quantite: qte,
                            motif: c.motif || `Consommation journalière (${qte})`
                        });
                        nbMouvementsTraites++;
                    }
                }

                if (payloadJour.length > 0) {
                    await get().declarerConsommationJournee(jour, payloadJour);
                }
            }

            set({ isLoading: false });
            return {
                nbJours: datesJours.length,
                nbMouvements: nbMouvementsTraites
            };
        } catch (error: any) {
            console.error('Erreur déclaration consommation période:', error);
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    deleteMouvement: async (id: string) => {
        set({ isLoading: true });
        try {
            const mouvement = get().mouvements.find(m => m.id === id);
            if (!mouvement) throw new Error("Mouvement introuvable");

            const matiere = get().matieres.find(m => m.id === mouvement.matiereId);
            let finalStock = matiere ? Number(matiere.stockActuel || 0) : 0;
            const qte = Number(mouvement.quantite || 0);

            if (matiere) {
                if (mouvement.type === 'achat') {
                    finalStock -= qte;
                } else if (['consommation', 'perte', 'retour_fournisseur'].includes(mouvement.type)) {
                    finalStock += qte;
                } else if (mouvement.type === 'correction') {
                    finalStock -= qte;
                }
                finalStock = Math.round((finalStock + Number.EPSILON) * 100) / 100;
            }

            const now = new Date();

            // Optimistic update
            set(state => ({
                matieres: matiere ? state.matieres.map(m => m.id === mouvement.matiereId ? {
                    ...m,
                    stockActuel: finalStock,
                    updatedAt: now
                } : m) : state.matieres,
                mouvements: state.mouvements.filter(m => m.id !== id),
                isLoading: false
            }));

            const promises: Promise<any>[] = [firestoreService.delete('mouvements', id)];
            if (matiere) {
                promises.push(firestoreService.update('matieres', matiere.id, {
                    stockActuel: finalStock,
                    updatedAt: now
                }));
            }

            await Promise.all(promises);
            console.log('✅ Mouvement supprimé avec succès');
        } catch (error: any) {
            console.error('Erreur suppression mouvement:', error);
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    updateMouvement: async (id: string, updates: Partial<MouvementStock>) => {
        set({ isLoading: true });
        try {
            await runTransaction(db, async (transaction) => {
                const mouvementRef = doc(db, 'mouvements', id);
                const mouvementDoc = await transaction.get(mouvementRef);
                if (!mouvementDoc.exists()) throw new Error("Mouvement introuvable");

                const oldMouvement = mouvementDoc.data() as MouvementStock;

                // Si la quantité ou le type change, il faut impacter le stock
                const quantiteChange = updates.quantite !== undefined && updates.quantite !== oldMouvement.quantite;
                const typeChange = updates.type !== undefined && updates.type !== oldMouvement.type;
                const matiereChange = updates.matiereId !== undefined && updates.matiereId !== oldMouvement.matiereId;

                if (quantiteChange || typeChange || matiereChange) {
                    // Complexe : On annule l'ancien et on applique le nouveau
                    // 1. Annuler l'ancien sur l'ancienne matière
                    const oldMatiereRef = doc(db, 'matieres', oldMouvement.matiereId);
                    const oldMatiereDoc = await transaction.get(oldMatiereRef);

                    if (oldMatiereDoc.exists()) {
                        let stockRevert = oldMatiereDoc.data().stockActuel;
                        const oldQte = oldMouvement.quantite;

                        if (oldMouvement.type === 'achat') stockRevert -= oldQte;
                        else if (['consommation', 'perte', 'retour_fournisseur'].includes(oldMouvement.type)) stockRevert += oldQte;
                        else if (oldMouvement.type === 'correction') stockRevert -= oldQte;

                        transaction.update(oldMatiereRef, { stockActuel: stockRevert, updatedAt: new Date() });
                    }

                    // 2. Appliquer le nouveau sur la nouvelle (ou même) matière
                    // Attention: Si c'est la même matière, il faut prendre le stockRevert comme base !
                    const newMatiereId = updates.matiereId || oldMouvement.matiereId;

                    if (newMatiereId === oldMouvement.matiereId) {
                        // Même matière -> on réutilise le doc déjà lu (mais attention on a calculé stockRevert 'virtuellement' ci-dessus sans l'écrire encore dans 'transaction' state pour lecture suivante ?)
                        // Firestore transactions : writes are applied at end. So subsequent gets() don't see previous writes inside tx unless we track it manually.
                        // Ici on doit calculer : baseStock = (oldMatiereDoc.data().stockActuel) [Initial]
                        // step1: baseStock - oldEffect
                        // step2: baseStock - oldEffect + newEffect

                        // Recalculons proprement
                        if (oldMatiereDoc.exists()) {
                            let currentStock = oldMatiereDoc.data().stockActuel;

                            // Reverse Old
                            if (oldMouvement.type === 'achat') currentStock -= oldMouvement.quantite;
                            else if (['consommation', 'perte', 'retour_fournisseur'].includes(oldMouvement.type)) currentStock += oldMouvement.quantite;
                            else if (oldMouvement.type === 'correction') currentStock -= oldMouvement.quantite;

                            // Apply New
                            const newType = updates.type || oldMouvement.type;
                            const newQte = updates.quantite !== undefined ? updates.quantite : oldMouvement.quantite;

                            if (newType === 'achat') currentStock += newQte;
                            else if (['consommation', 'perte', 'retour_fournisseur'].includes(newType)) currentStock -= newQte;
                            else if (newType === 'correction') currentStock += newQte;

                            transaction.update(oldMatiereRef, { stockActuel: currentStock, updatedAt: new Date() });
                        }
                    } else {
                        // Matière différente (Rare mais possible si erreur de saisie)
                        // L'ancien stock a déjà été prévu d'être update ci-dessus (stockRevert).

                        // Traitons la nouvelle matière
                        const newMatRef = doc(db, 'matieres', newMatiereId);
                        const newMatDoc = await transaction.get(newMatRef);

                        if (newMatDoc.exists()) {
                            let newMatStock = newMatDoc.data().stockActuel;
                            const newType = updates.type || oldMouvement.type;
                            const newQte = updates.quantite !== undefined ? updates.quantite : oldMouvement.quantite;

                            if (newType === 'achat') newMatStock += newQte;
                            else if (['consommation', 'perte', 'retour_fournisseur'].includes(newType)) newMatStock -= newQte;
                            else if (newType === 'correction') newMatStock += newQte;

                            transaction.update(newMatRef, { stockActuel: newMatStock, updatedAt: new Date() });
                        }
                    }
                }

                // Update du Mouvement lui-même
                const cleanUpdates: any = { ...updates, updatedAt: new Date() };
                Object.keys(cleanUpdates).forEach(key => {
                    if (cleanUpdates[key] === undefined) {
                        delete cleanUpdates[key];
                    }
                });

                transaction.update(mouvementRef, cleanUpdates);
            });

            await get().chargerDonnees();
            console.log('✅ Mouvement mis à jour');
        } catch (error: any) {
            console.error('Erreur mise à jour mouvement:', error);
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },


    getMatiere: (id) => get().matieres.find((m) => m.id === id),

    getMouvementsByMatiere: (matiereId) => {
        return get().mouvements
            .filter((m) => m.matiereId === matiereId);
        // Le tri est déjà fait au chargement
    },

    reparerHistoriqueStock: async () => {
        set({ isLoading: true });
        try {
            const { matieres, mouvements } = get();
            const updatesLocales: Record<string, { prixUnitaireMoyen: number; stockActuel: number }> = {};
            
            for (const matiere of matieres) {
                const mvtsMatiere = mouvements
                    .filter(m => m.matiereId === matiere.id)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                
                let stockSimule = 0;
                let pmpSimule = 0;
                
                for (const mvt of mvtsMatiere) {
                    if (mvt.type === 'achat') {
                        const qte = mvt.quantite;
                        if (mvt.prixUnitaire && mvt.prixUnitaire > 0) {
                            const ancienStockVal = Math.max(0, stockSimule) * pmpSimule;
                            const nouvelAchatVal = qte * mvt.prixUnitaire;
                            const stockTotalTheorique = Math.max(0, stockSimule) + qte;
                            
                            if (stockTotalTheorique > 0) {
                                pmpSimule = (ancienStockVal + nouvelAchatVal) / stockTotalTheorique;
                            } else {
                                pmpSimule = mvt.prixUnitaire;
                            }
                        } else if (pmpSimule === 0 && mvt.prixUnitaire) {
                            pmpSimule = mvt.prixUnitaire;
                        }
                        stockSimule += qte;
                    } else if (['consommation', 'perte', 'retour_fournisseur'].includes(mvt.type)) {
                        stockSimule -= mvt.quantite;
                    } else if (mvt.type === 'correction') {
                        stockSimule += mvt.quantite; 
                    }
                }
                
                const fixedStock = Math.round(stockSimule * 1000) / 1000;
                const fixedPmp = Math.round(pmpSimule * 100) / 100;
                updatesLocales[matiere.id] = { prixUnitaireMoyen: fixedPmp, stockActuel: fixedStock };
            }

            // 1. Mise à jour immédiate en mémoire locale (instantané sans blocage)
            set(state => ({
                matieres: state.matieres.map(m => updatesLocales[m.id] ? { ...m, ...updatesLocales[m.id] } : m),
                isLoading: false
            }));

            // 2. Sauvegarde Firestore avec timeout de sécurité de 5s pour ne jamais bloquer l'UI
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_QUOTA')), 5000));
            const savePromise = (async () => {
                for (const matiere of matieres) {
                    const u = updatesLocales[matiere.id];
                    if (u && (Math.abs(u.prixUnitaireMoyen - (matiere.prixUnitaireMoyen || 0)) > 0.01 || Math.abs(u.stockActuel - matiere.stockActuel) > 0.01)) {
                        await firestoreService.update('matieres', matiere.id, u);
                    }
                }
            })();

            await Promise.race([savePromise, timeoutPromise]).catch(err => {
                console.warn('Sauvegarde Firestore partielle ou différée:', err);
            });
            
            toast.success("PMP et stocks recalculés avec succès !");
        } catch (error: any) {
            console.error("Erreur lors de la réparation de l'historique", error);
            if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota') || error?.message === 'TIMEOUT_QUOTA') {
                toast.error("Quota Firestore quotidien atteint. Le recalcul a été appliqué localement en mémoire.");
            } else {
                toast.error("Erreur lors de la réparation.");
            }
        } finally {
            set({ isLoading: false });
        }
    }
}));
