import React, { useState, useEffect } from 'react';
import { useStockStore } from '../../store/stockStore';
import { ChevronLeft, Save, Calendar, Package } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface LigneDeclaration {
    matiereId: string;
    nom: string;
    unite: string; // Unité de base (stockage)
    stockActuel: number;
    qteSaisie: string; // On utilise string pour permettre le champ vide

    // Champs pour la conversion d'unités
    inputUnit: string; // 'kg', 'g', 'l', 'sac', 'carton', 'sachet'
    weightFactor: number; // Poids en kg pour les unités complexes (sac -> 50, carton -> 10)
}

export const StockDeclaration: React.FC = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const {
        matieres,
        chargerDonnees: chargerStock,
        declarerConsommationJournee,
        isLoading
    } = useStockStore();

    const [lignes, setLignes] = useState<LigneDeclaration[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void }>({
        isOpen: false,
        message: '',
        onConfirm: () => { }
    });

    useEffect(() => {
        chargerStock();
    }, [chargerStock]);

    useEffect(() => {
        if (matieres.length > 0) {
            setLignes(prevLignes => {
                // Créer une map pour persister les états de saisie lors des rechargements
                const stateMap = new Map(prevLignes.map(l => [l.matiereId, {
                    qte: l.qteSaisie,
                    unit: l.inputUnit,
                    factor: l.weightFactor
                }]));

                return matieres
                    .filter(m => m.active)
                    .map(m => {
                        const savedState = stateMap.get(m.id);

                        // Default logic: Si pas d'état, on check si on peut mettre par défaut en 'sac'
                        // L'utilisateur veut 'sacs' par défaut.
                        // On applique ça seulement si l'unité est compatible (kg ou g).
                        const isBaseWeightUnit = ['kg', 'g'].includes(m.unite);
                        const defaultUnit = isBaseWeightUnit ? 'sac' : m.unite;
                        const defaultFactor = defaultUnit === 'sac' ? 50 : 1;

                        // Vérifier la cohérence de l'état sauvegardé
                        let unitToUse = savedState?.unit || defaultUnit;
                        let factorToUse = savedState?.factor || defaultFactor;

                        if (unitToUse === 'sac' && !isBaseWeightUnit) {
                            unitToUse = m.unite;
                            factorToUse = 1;
                        }

                        return {
                            matiereId: m.id,
                            nom: m.nom,
                            unite: m.unite,
                            stockActuel: m.stockActuel,
                            // Restauration ou valeurs par défaut
                            qteSaisie: savedState?.qte || '',
                            inputUnit: unitToUse,
                            weightFactor: factorToUse
                        };
                    })
                    .sort((a, b) => a.nom.localeCompare(b.nom));
            });
        }
    }, [matieres]);

    const handleQteChange = (matiereId: string, valeur: string) => {
        // Validation basique : positif uniquement
        if (valeur && parseFloat(valeur) < 0) return;

        setLignes(prev => prev.map(l =>
            l.matiereId === matiereId ? { ...l, qteSaisie: valeur } : l
        ));
    };

    const handleUnitChange = (matiereId: string, newUnit: string) => {
        setLignes(prev => prev.map(l => {
            if (l.matiereId !== matiereId) return l;

            // Définir des poids par défaut logiques lors du changement d'unité
            let newFactor = l.weightFactor;
            if (newUnit === 'sac') newFactor = 50;
            else if (newUnit === 'carton') newFactor = 10;
            else if (newUnit === 'sachet') newFactor = 0.5;
            else if (newUnit === l.unite) newFactor = 1; // Retour à l'unité de base

            return { ...l, inputUnit: newUnit, weightFactor: newFactor };
        }));
    };

    const handleFactorChange = (matiereId: string, newFactor: string) => {
        const factor = parseFloat(newFactor);
        if (isNaN(factor) || factor <= 0) return; // Allow empty string for input, but validate on parse

        setLignes(prev => prev.map(l =>
            l.matiereId === matiereId ? { ...l, weightFactor: factor } : l
        ));
    };

    const handleValider = async () => {
        const lignesASauvegarder = lignes.filter(l => l.qteSaisie && parseFloat(l.qteSaisie) > 0);

        if (lignesASauvegarder.length === 0) {
            toast.error("Veuillez saisir au moins une quantité à déclarer");
            return;
        }

        const resolveFactor = (l: typeof lignes[0]) => {
            if (l.inputUnit === l.unite) return 1;
            if (l.inputUnit === 'sac' && l.unite.includes('sac')) return 1;
            return l.weightFactor;
        };

        const message = lignesASauvegarder.map(l => {
            const qte = parseFloat(l.qteSaisie);
            const factor = resolveFactor(l);
            if (l.inputUnit !== l.unite && factor !== 1) {
                return `- ${l.nom}: ${qte} ${l.inputUnit}(s) (x${factor}) = ${(qte * factor).toLocaleString()} ${l.unite}`;
            }
            return `- ${l.nom}: ${qte.toLocaleString()} ${l.unite}`;
        }).join('\n');

        setConfirmModal({
            isOpen: true,
            message: `Confirmez-vous la consommation suivante ?\n\n${message}`,
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    await declarerConsommationJournee(
                        new Date(date),
                        lignesASauvegarder.map(l => {
                            let quantiteFinale = parseFloat(l.qteSaisie);
                            // Conversion si unité spéciale (sac, carton, etc)
                            const factor = resolveFactor(l);
                            if (l.inputUnit !== l.unite) {
                                quantiteFinale *= factor;
                            }

                            // Génération du motif détaillé pour l'historique
                            // Ex: "Déclaration journalière (2 sacs)"
                            let motif = "Déclaration journalière";
                            if (l.inputUnit !== l.unite) {
                                const nbColis = parseFloat(l.qteSaisie);
                                motif += ` (${nbColis} ${l.inputUnit}${nbColis > 1 ? 's' : ''})`;
                            } else if (l.unite === 'kg' && quantiteFinale >= 50) {
                                // Heuristique automatique si saisi en kg direct mais gros volume
                                const nbSacs = (quantiteFinale / 50).toFixed(1);
                                if (parseFloat(nbSacs) >= 1) {
                                    motif += ` (~${nbSacs.replace('.0', '')} sacs)`;
                                }
                            }

                            return {
                                matiereId: l.matiereId,
                                quantite: quantiteFinale,
                                motif: motif
                            };
                        })
                    );
                    toast.success("Déclaration stock validée avec succès !");
                    navigate('/stocks');
                } catch (error) {
                    console.error(error);
                    toast.error("Erreur lors de la validation");
                } finally {
                    setIsSubmitting(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const lignesFiltrees = lignes.filter(l =>
        l.nom.toLowerCase().includes(filterText.toLowerCase())
    );

    const totalArticlesSaisis = lignes.filter(l => l.qteSaisie && parseFloat(l.qteSaisie) > 0).length;

    if (isLoading && lignes.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <Link
                        to="/stocks"
                        className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                    >
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Saisie des consommations</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border shadow-sm">
                        <Calendar className="w-5 h-5 text-gray-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="border-none focus:ring-0 text-gray-700 font-medium bg-transparent outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
                    <div className="relative w-full sm:max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Package className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Ex: Farine, Sucre, Levure..."
                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                        <span className={`font-semibold ${totalArticlesSaisis > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                            {totalArticlesSaisis}
                        </span>
                        <span>article(s) à déclarer</span>
                    </div>
                </div>

                {/* Table Scrollable */}
                <div className="flex-1 overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200 relative">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                                    Matière Première
                                </th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Stock Actuel
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-indigo-600 uppercase tracking-wider w-64">
                                    Quantité Utilisée
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                                    Unité & Conversion
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {lignesFiltrees.map((ligne) => {
                                const isPackaged = ligne.inputUnit !== ligne.unite;
                                const showPackageOptions = ['kg', 'g'].includes(ligne.unite);
                                
                                // Calcul robuste du facteur réel
                                const resolveFactor = (l: typeof ligne) => {
                                    if (l.inputUnit === l.unite) return 1;
                                    // Si on a sélectionné 'sac' mais que l'unité de base est déjà un sac
                                    if (l.inputUnit === 'sac' && l.unite.includes('sac')) return 1;
                                    return l.weightFactor;
                                };
                                const effectiveFactor = resolveFactor(ligne);

                                return (
                                    <tr key={ligne.matiereId} className={`hover:bg-gray-50 transition-colors ${ligne.qteSaisie ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{ligne.nom}</div>
                                            {isPackaged && (
                                                <div className="text-xs text-indigo-600 mt-1 font-medium">
                                                    ~ {(parseFloat(ligne.qteSaisie || '0') * effectiveFactor).toLocaleString()} {ligne.unite}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${ligne.stockActuel <= 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {ligne.stockActuel.toLocaleString()} {ligne.unite}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step="0.01"
                                                placeholder="0"
                                                value={ligne.qteSaisie}
                                                onChange={(e) => handleQteChange(ligne.matiereId, e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                className={`
                                                block w-32 ml-auto rounded-md shadow-sm border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-center font-bold h-10
                                                ${ligne.qteSaisie ? 'border-indigo-300 bg-white text-indigo-700' : 'bg-gray-50'}
                                            `}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex flex-col gap-2">
                                                <select
                                                    value={ligne.inputUnit}
                                                    onChange={(e) => handleUnitChange(ligne.matiereId, e.target.value)}
                                                    className="block w-full text-xs rounded-md border-gray-300 py-1.5 focus:border-indigo-500 focus:ring-indigo-500"
                                                >
                                                    <option value={ligne.unite}>{ligne.unite} (Base)</option>
                                                    {showPackageOptions && (
                                                        <>
                                                            <option value="sac">Sac</option>
                                                            <option value="carton">Carton</option>
                                                            <option value="sachet">Sachet</option>
                                                        </>
                                                    )}
                                                </select>

                                                {isPackaged && (
                                                    <div className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-1">
                                                        <span className="text-xs text-gray-500">x</span>
                                                        <input
                                                            type="number"
                                                            value={ligne.weightFactor}
                                                            onChange={(e) => handleFactorChange(ligne.matiereId, e.target.value)}
                                                            className="block w-12 text-xs border-none bg-transparent p-0 focus:ring-0 font-medium text-gray-700 text-center"
                                                        />
                                                        <span className="text-xs text-gray-500">{ligne.unite}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {lignesFiltrees.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        Aucune matière trouvée
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-end sticky bottom-0 z-20">
                    <button
                        onClick={handleValider}
                        disabled={isSubmitting || totalArticlesSaisis === 0}
                        className={`
                            flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-md transition-all
                            ${isSubmitting || totalArticlesSaisis === 0
                                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg transform hover:-translate-y-0.5'
                            }
                        `}
                    >
                        <Save className="w-5 h-5 mr-2" />
                        {isSubmitting ? 'Validation...' : `Valider la déclaration (${totalArticlesSaisis})`}
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title="Confirmer la déclaration journalière"
                message={confirmModal.message}
                confirmText="Valider et Enregistrer"
                cancelText="Annuler"
                type="info"
            />
        </div>
    );
};
