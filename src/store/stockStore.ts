import { create } from 'zustand';
import toast from 'react-hot-toast';
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
                let newPMP = matiere.prixUnitaireMoyen || 0;

                // 2. Calculer les nouvelles valeurs
                if (mouvementData.type === 'achat') {
                    const quantiteAchat = mouvementData.quantite;

                    // Calcul du PMP (Prix Moyen Pondéré)
                    // Formule : ((AncienStock * AncienPMP) + (QteAchat * PrixAchat)) / (AncienStock + QteAchat)
                    if (mouvementData.prixUnitaire && mouvementData.prixUnitaire > 0) {
                        const ancienStockVal = Math.max(0, newStock) * newPMP; // On évite les stocks négatifs pour la valo
                        const nouvelAchatVal = quantiteAchat * mouvementData.prixUnitaire;
                        const stockTotalTheorique = Math.max(0, newStock) + quantiteAchat;

                        if (stockTotalTheorique > 0) {
                            newPMP = (ancienStockVal + nouvelAchatVal) / stockTotalTheorique;
                        } else {
                            // Si stock total est 0 ou moins (bizarre après un achat positif), on prend le prix du dernier achat
                            newPMP = mouvementData.prixUnitaire;
                        }
                    } else if (newPMP === 0 && mouvementData.prixUnitaire) {
                        // Si pas de PMP avant (0) et qu'on a un prix, c'est le nouveau PMP
                        newPMP = mouvementData.prixUnitaire;
                    }

                    newStock += quantiteAchat;

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
                }

                // 3. Préparer le mouvement à créer
                const newMouvementRef = doc(collection(db, 'mouvements'));

                const newMouvement: any = {
                    id: newMouvementRef.id,
                    ...mouvementData,
                    createdAt: new Date(),
                    date: mouvementData.date ? new Date(mouvementData.date) : new Date(),
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
                    // Arrondi 2 décimales : évite l'accumulation d'artefacts de virgule flottante
                    stockActuel: Math.round((newStock + Number.EPSILON) * 100) / 100,
                    prixUnitaireMoyen: newPMP, // Mise à jour du PMP
                    updatedAt: new Date()
                });
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

    deleteMouvement: async (id: string) => {
        set({ isLoading: true });
        try {
            await runTransaction(db, async (transaction) => {
                const mouvementRef = doc(db, 'mouvements', id);
                const mouvementDoc = await transaction.get(mouvementRef);
                if (!mouvementDoc.exists()) throw new Error("Mouvement introuvable");

                const mouvement = mouvementDoc.data() as MouvementStock;
                const matiereRef = doc(db, 'matieres', mouvement.matiereId);
                const matiereDoc = await transaction.get(matiereRef);

                if (matiereDoc.exists()) {
                    const matiere = matiereDoc.data() as MatierePremiere;
                    let newStock = matiere.stockActuel;

                    // Annuler l'effet du mouvement
                    // Note: Dans la BDD, 'quantite' est stockée en positif souvent mais il faut vérifier la logique d'addMouvement
                    // Dans addMouvement:
                    // Achat -> +quantite
                    // Conso/Perte -> -quantite (mais stocké comment ? 'signedQuantity' est calculé pour le stock, mais le mouvement a le champ quantite)
                    // Regardons addMouvement: transaction.set(..., { quantite: finalQuantity }) où finalQuantity est positif
                    // Et stock += signedQuantity.
                    // Donc mouvement.quantite est la valeur ABSOLUE généralement.

                    const qte = mouvement.quantite;

                    if (mouvement.type === 'achat') {
                        // C'était une entrée, donc on retire du stock
                        newStock -= qte;
                    } else if (['consommation', 'perte', 'retour_fournisseur'].includes(mouvement.type)) {
                        // C'était une sortie, donc on ré-ajoute au stock
                        newStock += qte;
                    } else if (mouvement.type === 'correction') {
                        // Correction: On suppose que c'était un ajout si positif (implémentation actuelle simple)
                        // Si on veut être rigoureux faudrait stocker le delta signé. 
                        // Mais pour l'instant 'correction' dans addMouvement fait += quantite.
                        newStock -= qte;
                    }

                    transaction.update(matiereRef, {
                        stockActuel: Math.round((newStock + Number.EPSILON) * 100) / 100,
                        updatedAt: new Date()
                    });
                }

                transaction.delete(mouvementRef);
            });

            await get().chargerDonnees();
            console.log('✅ Mouvement supprimé');
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
            
            for (const matiere of matieres) {
                // On récupère tous les mouvements de cette matière, triés par date croissante (du plus vieux au plus récent)
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
                
                // Si divergence, on corrige dans Firebase
                const fixedStock = Math.round(stockSimule * 1000) / 1000;
                if (Math.abs(pmpSimule - (matiere.prixUnitaireMoyen || 0)) > 0.01 || Math.abs(fixedStock - matiere.stockActuel) > 0.01) {
                    console.log(`Réparation ${matiere.nom}: PMP -> ${pmpSimule} (était ${matiere.prixUnitaireMoyen}), Stock -> ${fixedStock} (était ${matiere.stockActuel})`);
                    await firestoreService.update('matieres', matiere.id, { 
                        prixUnitaireMoyen: pmpSimule,
                        stockActuel: fixedStock
                    });
                }
            }
            
            await get().chargerDonnees();
            toast.success("Historique des stocks et PMP réparé avec succès !");
            set({ isLoading: false });
        } catch (error: any) {
            console.error("Erreur lors de la réparation de l'historique", error);
            set({ isLoading: false, error: error.message });
            toast.error("Erreur lors de la réparation.");
        }
    }
}));
