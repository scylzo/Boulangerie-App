import React, { useState, useEffect } from 'react';
import { useProductionStore } from '../../store/productionStore';
import { useStockStore } from '../../store/stockStore';
import { ChevronLeft, Save, AlertTriangle, Calendar, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface LigneDeclaration {
    matiereId: string;
    nom: string;
    unite: string;
    qteTheorique: number;
    qteReelle: number;
}

export const StockDeclaration: React.FC = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const {
        programmeActuel,
        chargerProgramme,
        produits,
        chargerProduits,
        calculerTotauxParProduit // Import the action
    } = useProductionStore();
    const { declarerConsommationJournee, matieres, chargerDonnees: chargerStock } = useStockStore();

    const [lignes, setLignes] = useState<LigneDeclaration[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const initData = async () => {
            await Promise.all([chargerProduits(), chargerStock()]);
        };
        initData();
    }, []);

    useEffect(() => {
        if (date) {
            // Créer une date locale à partir de la chaîne YYYY-MM-DD
            // split('-') permet d'éviter les problèmes de timezone en passant des arguments numériques
            const [year, month, day] = date.split('-').map(Number);
            // On crée une date à MIDI pour éviter les problèmes de fuseaux horaires
            const dateObj = new Date(year, month - 1, day, 12, 0, 0);
            chargerProgramme(dateObj);
        }
    }, [date]);

    useEffect(() => {
        // Si le programme est chargé mais n'a pas de totaux pré-calculés, on les calcule maintenant
        if (programmeActuel && (!programmeActuel.totauxParProduit || programmeActuel.totauxParProduit.length === 0)) {
            const hasData = (programmeActuel.commandesClients && programmeActuel.commandesClients.length > 0) ||
                (programmeActuel.quantitesBoutique && programmeActuel.quantitesBoutique.length > 0);

            if (hasData) {
                console.log("⚠️ Totaux manquants, calcul à la volée...");
                calculerTotauxParProduit();
                return; // On attend que le store se mette à jour
            }
        }
        calculerTheorique();
    }, [programmeActuel, produits, matieres]);

    const calculerTheorique = () => {
        if (!programmeActuel || !programmeActuel.totauxParProduit || matieres.length === 0) {
            setLignes([]);
            return;
        }

        const cumuls = new Map<string, number>();

        programmeActuel.totauxParProduit.forEach(total => {
            const produit = produits.find(p => p.id === total.produitId);

            if (produit?.recette) {
                // Priorité à la quantité réelle saisie en prod, sinon total théorique
                const qteRef = total.quantiteProduiteReelle ?? total.totalGlobal;

                produit.recette.forEach(ing => {
                    const current = cumuls.get(ing.matiereId) || 0;
                    cumuls.set(ing.matiereId, current + (ing.quantite * qteRef));
                });
            }
        });

        // Transformer en tableau de lignes
        const nouvellesLignes: LigneDeclaration[] = [];

        // On ne prend que les matières qui ont une consommation théorique > 0
        // OU on pourrait lister toutes les matières ? Non, restons sur celles utilisées.

        cumuls.forEach((qte, matiereId) => {
            const matiere = matieres.find(m => m.id === matiereId);
            if (matiere) {
                nouvellesLignes.push({
                    matiereId,
                    nom: matiere.nom,
                    unite: matiere.unite,
                    qteTheorique: Number(qte.toFixed(3)),
                    qteReelle: Number(qte.toFixed(3)) // Par défaut = théorique
                });
            }
        });

        setLignes(nouvellesLignes.sort((a, b) => a.nom.localeCompare(b.nom)));
    };

    const handleQteChange = (matiereId: string, valeur: string) => {
        const qte = parseFloat(valeur);
        setLignes(prev => prev.map(l =>
            l.matiereId === matiereId ? { ...l, qteReelle: isNaN(qte) ? 0 : qte } : l
        ));
    };

    const handleValider = async () => {
        if (lignes.length === 0) {
            toast.error("Aucune consommation à déclarer");
            return;
        }

        if (!window.confirm("Confirmez-vous la déclaration de consommation pour cette journée ? Cela déduira les stocks.")) {
            return;
        }

        setIsSubmitting(true);
        try {
            await declarerConsommationJournee(
                new Date(date),
                lignes.map(l => ({ matiereId: l.matiereId, quantite: l.qteReelle }))
            );
            toast.success("Déclaration validée avec succès !");
            navigate('/stocks');
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la validation");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Si on veut ajouter une matière qui n'était pas prévue ?
    // Pour l'instant restons simple : correction des théoriques.
    // Idéalement il faudrait un bouton "Ajouter une matière hors recette".

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/stocks')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Déclaration Consommation</h1>
                        <p className="text-gray-500">Validation des sorties de stock journalières</p>
                    </div>
                </div>

                <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border shadow-sm">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="border-none focus:ring-0 text-gray-700 font-medium"
                    />
                </div>
            </div>

            {/* Info Panel if Program not validated */}
            {programmeActuel && programmeActuel.statut !== 'produit' && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                Le programme de production pour cette date n'est pas encore marqué comme "Produit".
                                Les quantités théoriques sont basées sur le prévisionnel.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-semibold flex items-center">
                        <Calculator className="w-5 h-5 mr-2 text-indigo-600" />
                        Consommations Calculées
                    </h2>
                    <div className="text-sm text-gray-500">
                        {lignes.length} matières utilisées
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matière Première</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qté Théorique</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Qté Réelle (Déclarée)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {lignes.map((ligne) => (
                                <tr key={ligne.matiereId} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{ligne.nom}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <div className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                                            {ligne.qteTheorique}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={ligne.qteReelle}
                                            onChange={(e) => handleQteChange(ligne.matiereId, e.target.value)}
                                            className={`block w-full text-center rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-bold
                                                ${ligne.qteReelle !== ligne.qteTheorique ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-gray-900'}
                                            `}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {ligne.unite}
                                    </td>
                                </tr>
                            ))}
                            {lignes.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        Aucune consommation calculée pour cette date.<br />
                                        Vérifiez qu'il y a un programme de production et des recettes définies.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={handleValider}
                        disabled={isSubmitting || lignes.length === 0}
                        className={`
                            flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white 
                            ${isSubmitting || lignes.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500'}
                        `}
                    >
                        <Save className="w-5 h-5 mr-2" />
                        {isSubmitting ? 'Validation...' : 'Valider la Déclaration'}
                    </button>
                </div>
            </div>
        </div>
    );
};
