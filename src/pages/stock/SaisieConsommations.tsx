import React, { useState, useEffect, useMemo } from 'react';
import { useStockStore } from '../../store/stockStore';
import { ChevronLeft, Save, Calendar, Package, Fuel, Calculator, ChevronDown, History, Pencil } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { formatCurrency } from '../../utils/currency';
import { formaterQuantite } from '../../utils/calculations';
import { memeJour } from '../../utils/dateUtils';

interface LigneConsommation {
    matiereId: string;
    nom: string;
    unite: string; // Unité de base (stockage)
    stockActuel: number;
    qteSaisie: string; // On utilise string pour permettre le champ vide

    // Champs pour la conversion d'unités
    inputUnit: string; // 'kg', 'g', 'l', 'sac', 'carton', 'sachet'
    weightFactor: number; // Poids en kg pour les unités complexes (sac -> 50, carton -> 10)
    prixUnitaireMoyen: number;
    mouvementId?: string; // Si déjà saisi pour cette date, on stocke l'ID pour l'édition
}

export const SaisieConsommations: React.FC = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const {
        matieres,
        mouvements,
        chargerDonnees: chargerStock,
        declarerConsommationJournee,
        isLoading
    } = useStockStore();

    const [lignes, setLignes] = useState<LigneConsommation[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void }>({
        isOpen: false,
        message: '',
        onConfirm: () => { }
    });

    // --- DEBUT: Variables pour l'outil de calcul ---
    const [showCalculator, setShowCalculator] = useState(false);
    const [calcBaguettes, setCalcBaguettes] = useState('');
    const [calcPistolets, setCalcPistolets] = useState('');
    const [calcPetitsPains, setCalcPetitsPains] = useState('');
    const [calcPainsAuLait, setCalcPainsAuLait] = useState('');
    const [calcDefaut, setCalcDefaut] = useState('');

    const calculateFarineKgs = () => {
        const bag = parseInt(calcBaguettes || '0', 10);
        const pist = parseInt(calcPistolets || '0', 10);
        const pp = parseInt(calcPetitsPains || '0', 10);
        const pal = parseInt(calcPainsAuLait || '0', 10);
        const defautKg = parseFloat(calcDefaut || '0');

        // Calcul classique (Coefficient 1.633)
        const totalGrClassique = (bag * 275) + (pist * 170) + (pp * 100) + (defautKg * 1000);
        const farineClassique = totalGrClassique / 1633;

        // Calcul Pains au Lait (Coefficient 1.793)
        const farinePAL = (pal * 250) / 1793;

        return farineClassique + farinePAL;
    };

    const calculateFarineSacs = () => {
        return calculateFarineKgs() / 50;
    };
    // --- FIN: Variables pour l'outil de calcul ---

    useEffect(() => {
        chargerStock();
    }, [chargerStock]);

    const dejaSaisisPourDate = useMemo(() => {
        if (!date) return [];
        // On crée une date à midi pour éviter les problèmes de timezone lors de la comparaison
        const targetDate = new Date(date + 'T12:00:00');
        return mouvements.filter(m =>
            m.type === 'consommation' && memeJour(new Date(m.date), targetDate)
        );
    }, [mouvements, date]);

    useEffect(() => {
        if (matieres.length > 0) {
            setLignes(prevLignes => {
                const stateMap = new Map(prevLignes.map(l => [l.matiereId, {
                    qte: l.qteSaisie,
                    unit: l.inputUnit,
                    factor: l.weightFactor
                }]));

                return matieres
                    .filter(m => m.active)
                    .map(m => {
                        const savedState = stateMap.get(m.id);
                        
                        // Est-ce qu'on a déjà une saisie pour cette matière à cette date ?
                        const mouvementExistant = dejaSaisisPourDate.find(mv => mv.matiereId === m.id);

                        // Logique par défaut intelligente
                        const isFuel = m.nom.toLowerCase().includes('carburant') || m.nom.toLowerCase().includes('gasoil');
                        const isBaseWeightUnit = ['kg', 'g'].includes(m.unite);
                        let defaultUnit = isFuel ? 'l' : (isBaseWeightUnit ? 'sac' : m.unite);
                        let defaultFactor = defaultUnit === 'sac' ? 50 : 1;
                        let defaultQte = savedState?.qte || '';

                        // Si mouvement existant, on pré-remplit les données réelles
                        if (mouvementExistant) {
                            defaultQte = mouvementExistant.quantite.toString();
                            
                            // Tentative d'extraction de l'unité depuis le motif
                            const motif = mouvementExistant.motif || '';
                            const matchParenthese = motif.match(/\(([\d.]+)\s*([a-zA-Z]+)s?\)/);
                            if (matchParenthese) {
                                const qteOriginale = matchParenthese[1];
                                const unitStr = matchParenthese[2].toLowerCase();
                                
                                if (unitStr.includes('sac')) {
                                    defaultUnit = 'sac';
                                    defaultFactor = m.unite.toLowerCase().includes('sac') ? 1 : 50;
                                    defaultQte = qteOriginale;
                                } else if (unitStr.includes('carton')) {
                                    defaultUnit = 'carton';
                                    defaultFactor = m.unite.toLowerCase().includes('carton') ? 1 : 10;
                                    defaultQte = qteOriginale;
                                } else if (unitStr.includes('sachet')) {
                                    defaultUnit = 'sachet';
                                    defaultFactor = m.unite.toLowerCase().includes('sachet') ? 1 : 0.5;
                                    defaultQte = qteOriginale;
                                }
                            } else {
                                // Pas de motif complexe, on utilise l'unité de base
                                defaultUnit = m.unite;
                                defaultFactor = 1;
                            }
                        }

                        // Vérifier si l'état sauvegardé est toujours cohérent (si pas de mouvement existant)
                        let unitToUse = !mouvementExistant && savedState?.unit ? savedState.unit : defaultUnit;
                        let factorToUse = !mouvementExistant && savedState?.factor ? savedState.factor : defaultFactor;

                        if (unitToUse === 'sac' && (!isBaseWeightUnit || m.unite.includes('sac'))) {
                            unitToUse = m.unite;
                            factorToUse = 1;
                        }

                        return {
                            matiereId: m.id,
                            nom: m.nom,
                            unite: m.unite,
                            stockActuel: m.stockActuel,
                            qteSaisie: defaultQte,
                            inputUnit: unitToUse,
                            weightFactor: factorToUse,
                            prixUnitaireMoyen: m.prixUnitaireMoyen || 0,
                            mouvementId: mouvementExistant?.id
                        };
                    })
                    .sort((a, b) => a.nom.localeCompare(b.nom));
            });
        }
    }, [matieres]);

    const handlePreRemplir = () => {
        const selectedDate = new Date(date + 'T12:00:00');
        
        // Trier explicitement les mouvements par date décroissante pour être sûr
        const sortedMouvements = [...mouvements].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateB !== dateA) return dateB - dateA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Pré-calculer la dernière conso de chaque matière (STRICTEMENT avant la date sélectionnée)
        const lastConsoByMatiere = new Map<string, typeof mouvements[0]>();
        
        for (const m of sortedMouvements) {
            if (m.type === 'consommation') {
                const mDate = new Date(m.date);
                // On ignore les consos de la date sélectionnée et les consos futures
                if (mDate.getTime() < selectedDate.getTime() && !memeJour(mDate, selectedDate)) {
                    if (!lastConsoByMatiere.has(m.matiereId)) {
                        lastConsoByMatiere.set(m.matiereId, m);
                    }
                }
            }
        }

        let nbRemplis = 0;

        setLignes(prev => prev.map(ligne => {
            const lastMouvement = lastConsoByMatiere.get(ligne.matiereId);

            if (lastMouvement) {
                nbRemplis++;
                let unitToUse = ligne.inputUnit;
                let factorToUse = ligne.weightFactor;
                let qteToUse = lastMouvement.quantite;

                const motif = lastMouvement.motif || '';
                
                // Extraire le motif du genre "Consommation journalière (2 sacs)"
                const matchParenthese = motif.match(/\(([\d.]+)\s*([a-zA-Z]+)s?\)/);
                if (matchParenthese) {
                    const qteStr = matchParenthese[1];
                    const unitStr = matchParenthese[2].toLowerCase();
                    
                    if (unitStr.includes('sac')) {
                        unitToUse = 'sac';
                        // Si l'unité de base contient déjà "sac", le facteur est 1, sinon 50
                        factorToUse = ligne.unite.toLowerCase().includes('sac') ? 1 : 50; 
                        qteToUse = parseFloat(qteStr);
                    } else if (unitStr.includes('carton')) {
                        unitToUse = 'carton';
                        factorToUse = ligne.unite.toLowerCase().includes('carton') ? 1 : 10;
                        qteToUse = parseFloat(qteStr);
                    } else if (unitStr.includes('sachet')) {
                        unitToUse = 'sachet';
                        factorToUse = ligne.unite.toLowerCase().includes('sachet') ? 1 : 0.5;
                        qteToUse = parseFloat(qteStr);
                    }
                } else if (motif.includes('~') && motif.includes('sacs') && ligne.unite === 'kg') {
                    unitToUse = 'sac';
                    factorToUse = 50;
                    qteToUse = lastMouvement.quantite / 50;
                } else {
                     if (ligne.inputUnit !== ligne.unite && ligne.weightFactor > 0) {
                         qteToUse = lastMouvement.quantite / ligne.weightFactor;
                     }
                }

                // Arrondir pour éviter les 51.000000000001
                qteToUse = Math.round(qteToUse * 100) / 100;

                return {
                    ...ligne,
                    qteSaisie: qteToUse ? qteToUse.toString() : '',
                    inputUnit: unitToUse,
                    weightFactor: factorToUse
                };
            }
            return ligne;
        }));
        
        if (nbRemplis > 0) {
            toast.success(`Pré-rempli avec les dernières consommations connues (${nbRemplis} articles) !`, { duration: 4000 });
        } else {
            toast.error("Aucun historique de consommation trouvé.");
        }
    };

    const handleQteChange = (matiereId: string, valeur: string) => {
        if (valeur && parseFloat(valeur) < 0) return;
        setLignes(prev => prev.map(l =>
            l.matiereId === matiereId ? { ...l, qteSaisie: valeur } : l
        ));
    };

    const handleUnitChange = (matiereId: string, newUnit: string) => {
        setLignes(prev => prev.map(l => {
            if (l.matiereId !== matiereId) return l;

            let newFactor = l.weightFactor;
            if (newUnit === 'sac') newFactor = 50;
            else if (newUnit === 'carton') newFactor = 10;
            else if (newUnit === 'sachet') newFactor = 0.5;
            else if (newUnit === l.unite) newFactor = 1;
            
            // Logique de conversion inversée si l'unité de base est un sac (ex: sac_25kg) et on choisit de déclarer au kg ou g
            const isSacUnit = typeof l.unite === 'string' && l.unite.startsWith('sac_');
            if (isSacUnit && (newUnit === 'kg' || newUnit === 'g')) {
                const match = l.unite.match(/sac_(\d+)kg/);
                const weightInKg = match ? parseInt(match[1], 10) : 50;
                
                if (newUnit === 'kg') {
                    // 1 kg = 1 / poids_du_sac (en unité de base qui est le sac entier)
                    newFactor = 1 / weightInKg;
                } else if (newUnit === 'g') {
                    // 1 g = 1 / (poids_du_sac * 1000)
                    newFactor = 1 / (weightInKg * 1000);
                }
            }

            return { ...l, inputUnit: newUnit, weightFactor: newFactor };
        }));
    };

    const handleFactorChange = (matiereId: string, newFactor: string) => {
        const factor = parseFloat(newFactor);
        if (isNaN(factor) || factor <= 0) return;
        setLignes(prev => prev.map(l =>
            l.matiereId === matiereId ? { ...l, weightFactor: factor } : l
        ));
    };

    const handleValider = async () => {
        const lignesASauvegarder = lignes.filter(l => l.qteSaisie && parseFloat(l.qteSaisie) > 0);

        if (lignesASauvegarder.length === 0) {
            toast.error("Veuillez saisir au moins une quantité consommée");
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
            const action = l.mouvementId ? " [Mise à jour]" : "";
            if (l.inputUnit !== l.unite && factor !== 1) {
                return `- ${l.nom}: ${qte} ${l.inputUnit}(s) (x${factor}) = ${(qte * factor).toLocaleString()} ${l.unite}${action}`;
            }
            return `- ${l.nom}: ${qte.toLocaleString()} ${l.unite}${action}`;
        }).join('\n');

        setConfirmModal({
            isOpen: true,
            message: `Confirmez-vous la consommation suivante pour le ${new Date(date).toLocaleDateString()} ?\n\n${message}`,
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

                            let motif = "Consommation journalière";
                            if (l.inputUnit !== l.unite) {
                                const nbColis = parseFloat(l.qteSaisie);
                                motif += ` (${nbColis} ${l.inputUnit}${nbColis > 1 ? 's' : ''})`;
                            } else if (l.unite === 'kg' && quantiteFinale >= 50) {
                                const nbSacs = (quantiteFinale / 50).toFixed(1);
                                if (parseFloat(nbSacs) >= 1) {
                                    motif += ` (~${nbSacs.replace('.0', '')} sacs)`;
                                }
                            }

                            return {
                                id: l.mouvementId,
                                matiereId: l.matiereId,
                                quantite: quantiteFinale,
                                motif: motif
                            };
                        })
                    );
                    toast.success("Consommations enregistrées avec succès !");
                    navigate('/stocks');
                } catch (error) {
                    console.error(error);
                    toast.error("Erreur lors de l'enregistrement");
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

    const valorisationTotale = useMemo(() => {
        return lignes.reduce((acc, l) => {
            const qte = parseFloat(l.qteSaisie || '0');
            if (qte <= 0) return acc;
            // Sécurité : si l'unité d'entrée est identique à l'unité de base, le facteur DOIT être 1
            // Si l'unité d'entrée est 'sac' mais que l'unité de base contient 'sac', le facteur est aussi 1
            const factor = (l.inputUnit === l.unite || (l.inputUnit === 'sac' && l.unite.includes('sac'))) ? 1 : l.weightFactor;
            const qteBase = qte * factor;
            return acc + (qteBase * l.prixUnitaireMoyen);
        }, 0);
    }, [lignes]);

    if (isLoading && lignes.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terracotta-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-sand-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <Link
                        to="/stocks"
                        className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-sand-200"
                    >
                        <ChevronLeft className="w-6 h-6 text-sand-600" />
                    </Link>
                    <div>
                        <h1 className="font-display text-2xl font-semibold text-sand-900">Saisie des Consommations</h1>
                        <p className="text-sand-500">Intrants, Carburant Four, etc.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border shadow-sm">
                        <Calendar className="w-5 h-5 text-sand-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="border-none focus:ring-0 text-sand-700 font-medium bg-transparent outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-xl shadow-sm border border-sand-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
                {/* Toolbar */}
                <div className="p-4 border-b border-sand-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-sand-50/50">
                    <div className="relative w-full sm:max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Package className="h-5 w-5 text-sand-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Rechercher (Farine, Gasoil...)"
                            className="pl-10 block w-full rounded-md border-sand-300 shadow-sm focus:border-terracotta-500 focus:ring-terracotta-500 sm:text-sm py-2"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
                        <button
                            onClick={handlePreRemplir}
                            className="flex items-center gap-2 px-3 py-2 bg-terracotta-50 text-terracotta-700 rounded-lg hover:bg-terracotta-100 transition-colors font-semibold border border-terracotta-200 shadow-sm text-xs sm:text-sm"
                            title="Remplir automatiquement avec les quantités de la veille"
                        >
                            <History className="w-4 h-4" />
                            <span className="hidden md:inline">Remplir avec la dernière conso.</span>
                            <span className="inline md:hidden">Auto-remplir</span>
                        </button>

                        <div className="flex flex-col items-end text-sm border-l border-sand-200 pl-3">
                            <span className="text-sand-500 uppercase text-[10px] font-bold tracking-wider">Valorisation Totale</span>
                            <span className="text-lg font-black text-success-600 leading-none">
                                {formatCurrency(valorisationTotale)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-sand-600 bg-white px-3 py-1.5 rounded-full border border-sand-200 shadow-sm">
                            <span className={`font-semibold ${totalArticlesSaisis > 0 ? 'text-terracotta-600' : 'text-sand-400'}`}>
                                {totalArticlesSaisis}
                            </span>
                            <span>saisie(s)</span>
                        </div>
                    </div>
                </div>

                {/* --- DEBUT: Calculatrice de rendement --- */}
                <div className="border-b border-sand-200 bg-warning-50/30">
                    <button 
                        onClick={() => setShowCalculator(!showCalculator)}
                        className="w-full px-4 py-2 flex justify-between items-center text-warning-600 hover:bg-warning-50 transition-colors"
                    >
                        <div className="flex items-center font-semibold text-sm">
                            <Calculator className="w-4 h-4 mr-2" />
                            Outil d'estimation de consommation (Farine)
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showCalculator ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showCalculator && (
                        <div className="px-4 py-4 border-t border-warning-100 flex flex-col md:flex-row gap-6 items-start md:items-center bg-white/50">
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-sand-700 mb-1">Baguettes (275g)</label>
                                    <input type="number" value={calcBaguettes} onChange={e => setCalcBaguettes(e.target.value)} className="block w-full rounded-md border-warning-100 shadow-sm focus:border-warning-500 focus:ring-warning-500 sm:text-sm h-9 bg-white" placeholder="Ex: 1811" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-sand-700 mb-1">Pistolets (170g)</label>
                                    <input type="number" value={calcPistolets} onChange={e => setCalcPistolets(e.target.value)} className="block w-full rounded-md border-warning-100 shadow-sm focus:border-warning-500 focus:ring-warning-500 sm:text-sm h-9 bg-white" placeholder="Ex: 500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-sand-700 mb-1">Petits Pains (100g)</label>
                                    <input type="number" value={calcPetitsPains} onChange={e => setCalcPetitsPains(e.target.value)} className="block w-full rounded-md border-warning-100 shadow-sm focus:border-warning-500 focus:ring-warning-500 sm:text-sm h-9 bg-white" placeholder="Ex: 200" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-sand-700 mb-1">Pains au Lait (250g)</label>
                                    <input type="number" value={calcPainsAuLait} onChange={e => setCalcPainsAuLait(e.target.value)} className="block w-full rounded-md border-warning-100 shadow-sm focus:border-warning-500 focus:ring-warning-500 sm:text-sm h-9 bg-white" placeholder="Ex: 100" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-sand-700 mb-1">Autres (kg pâte)</label>
                                    <input type="number" step="0.1" value={calcDefaut} onChange={e => setCalcDefaut(e.target.value)} className="block w-full rounded-md border-warning-100 shadow-sm focus:border-warning-500 focus:ring-warning-500 sm:text-sm h-9 bg-white" placeholder="Ex: 15.5" />
                                </div>
                            </div>
                            
                            <div className="w-full md:w-56 bg-white p-3 rounded-lg border border-warning-100 shadow-sm text-center">
                                <div className="text-[10px] text-sand-500 font-bold uppercase tracking-wider mb-1">Farine nécessaire estimée</div>
                                <div className="text-2xl font-black text-warning-600">
                                    {calculateFarineSacs() > 0 ? calculateFarineSacs().toFixed(2) : '0.00'} <span className="text-xs font-bold text-sand-500">sacs</span>
                                </div>
                                <div className="text-xs text-sand-400 mt-0.5">
                                    ~ {calculateFarineKgs() > 0 ? calculateFarineKgs().toFixed(1) : '0'} kg au total
                                </div>
                                {calculateFarineSacs() > 0 && (
                                    <button 
                                        onClick={() => {
                                            const sacs = calculateFarineSacs().toFixed(2);
                                            setLignes(prev => prev.map(l => {
                                                if (l.nom.toLowerCase().includes('farine')) {
                                                    // Si l'unité de base est déjà un sac, on ne met pas de facteur 50
                                                    const isAlreadyBag = l.unite.includes('sac');
                                                    return { 
                                                        ...l, 
                                                        qteSaisie: sacs, 
                                                        inputUnit: isAlreadyBag ? l.unite : 'sac', 
                                                        weightFactor: isAlreadyBag ? 1 : 50 
                                                    };
                                                }
                                                return l;
                                            }));
                                            toast.success("Quantité suggérée appliquée à la farine !");
                                            setShowCalculator(false);
                                        }}
                                        className="mt-3 w-full bg-warning-100 hover:bg-warning-100 text-warning-600 font-bold py-1.5 px-2 rounded text-[11px] transition-colors uppercase tracking-wide flex items-center justify-center"
                                    >
                                        <Save className="w-3 h-3 mr-1" />
                                        Appliquer au tableau
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {/* --- FIN: Calculatrice de rendement --- */}

                {/* Table Scrollable */}
                <div className="flex-1 overflow-auto">
                    <table className="min-w-full divide-y divide-sand-200 relative">
                        <thead className="bg-sand-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider w-1/3">
                                    Matière / Carburant
                                </th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-sand-500 uppercase tracking-wider">
                                    Stock
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-terracotta-600 uppercase tracking-wider w-64">
                                    Consommation (Jour)
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider w-40">
                                    Unité
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-success-600 uppercase tracking-wider w-40">
                                    Valorisation
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-sand-200">
                            {lignesFiltrees.map((ligne) => {
                                // Calcul robuste du facteur réel
                                const resolveFactor = (l: typeof ligne) => {
                                    if (l.inputUnit === l.unite) return 1;
                                    // Si on a sélectionné 'sac' mais que l'unité de base est déjà un sac
                                    if (l.inputUnit === 'sac' && l.unite.includes('sac')) return 1;
                                    return l.weightFactor;
                                };
                                const effectiveFactor = resolveFactor(ligne);
                                const isPackaged = ligne.inputUnit !== ligne.unite;
                                const isBaseWeightUnit = ['kg', 'g'].includes(ligne.unite);
                                const isSacBaseUnit = typeof ligne.unite === 'string' && ligne.unite.startsWith('sac_');
                                const isFuel = ligne.nom.toLowerCase().includes('carburant') || ligne.nom.toLowerCase().includes('gasoil');
                                const isAlreadyEntered = dejaSaisisPourDate.some(m => m.matiereId === ligne.matiereId);

                                return (
                                    <tr key={ligne.matiereId} className={`hover:bg-sand-50 transition-colors ${ligne.qteSaisie ? 'bg-terracotta-50/30' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {isFuel ? <Fuel className="w-5 h-5 text-warning-500 mr-2" /> : <Package className="w-5 h-5 text-sand-400 mr-2" />}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-medium text-sand-900">{ligne.nom}</div>
                                                        {isAlreadyEntered && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-terracotta-100 text-terracotta-800 border border-terracotta-200 uppercase tracking-tighter">
                                                                <Pencil className="w-3 h-3 mr-1" />
                                                                Saisie enregistrée (Modifiable)
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isPackaged && (
                                                        <div className="text-xs text-terracotta-600 mt-1 font-medium">
                                                            ~ {(parseFloat(ligne.qteSaisie || '0') * effectiveFactor).toLocaleString()} {ligne.unite}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${ligne.stockActuel <= 0 ? 'bg-danger-100 text-danger-700' : 'bg-sand-100 text-sand-800'}`}>
                                                {formaterQuantite(ligne.stockActuel)} {ligne.unite}
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
                                                block w-32 ml-auto rounded-md shadow-sm border-sand-300 focus:border-terracotta-500 focus:ring-terracotta-500 sm:text-sm text-center font-bold h-10
                                                ${ligne.qteSaisie ? 'border-terracotta-300 bg-white text-terracotta-700' : 'bg-sand-50'}
                                                ${isAlreadyEntered ? 'opacity-50 cursor-not-allowed bg-sand-100' : ''}
                                            `}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-sand-500">
                                            <div className="flex flex-col gap-2">
                                                {!isFuel ? (
                                                    <select
                                                        value={ligne.inputUnit}
                                                        onChange={(e) => handleUnitChange(ligne.matiereId, e.target.value)}
                                                        className="block w-full text-xs rounded-md border-sand-300 py-1.5 focus:border-terracotta-500 focus:ring-terracotta-500"
                                                    >
                                                        <option value={ligne.unite}>{ligne.unite} (Base)</option>
                                                        {isBaseWeightUnit && (
                                                            <>
                                                                <option value="sac">Sac</option>
                                                                <option value="carton">Carton</option>
                                                                <option value="sachet">Sachet</option>
                                                            </>
                                                        )}
                                                        {isSacBaseUnit && (
                                                            <>
                                                                <option value="kg">kg</option>
                                                                <option value="g">g</option>
                                                            </>
                                                        )}
                                                    </select>
                                                ) : (
                                                    <span className="text-sm font-medium text-sand-600 px-2 py-1.5 bg-sand-50 rounded border border-sand-200 block text-center">
                                                        {ligne.unite}
                                                    </span>
                                                )}

                                                {isPackaged && (
                                                    <div className="flex items-center gap-1 bg-sand-100 rounded px-1.5 py-1">
                                                        <span className="text-xs text-sand-500">x</span>
                                                        <input
                                                            type="number"
                                                            value={ligne.weightFactor}
                                                            onChange={(e) => handleFactorChange(ligne.matiereId, e.target.value)}
                                                            className="block w-12 text-xs border-none bg-transparent p-0 focus:ring-0 font-medium text-sand-700 text-center"
                                                        />
                                                        <span className="text-xs text-sand-500">{ligne.unite}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-black text-sand-900">
                                            {ligne.qteSaisie && parseFloat(ligne.qteSaisie) > 0 ? (
                                                formatCurrency(parseFloat(ligne.qteSaisie) * effectiveFactor * ligne.prixUnitaireMoyen)
                                            ) : (
                                                <span className="text-sand-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {lignesFiltrees.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-sand-500">
                                        Aucun élément trouvé
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-white border-t border-sand-200 flex justify-end sticky bottom-0 z-20">
                    <button
                        onClick={handleValider}
                        disabled={isSubmitting || totalArticlesSaisis === 0}
                        className={`
                            flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-md transition-all
                            ${isSubmitting || totalArticlesSaisis === 0
                                ? 'bg-sand-300 cursor-not-allowed text-sand-500'
                                : 'bg-terracotta-600 hover:bg-terracotta-700 text-white hover:shadow-lg transform hover:-translate-y-0.5'
                            }
                        `}
                    >
                        <Save className="w-5 h-5 mr-2" />
                        {isSubmitting ? 'Enregistrement...' : `Enregistrer Consommations (${totalArticlesSaisis})`}
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title="Confirmer les consommations"
                message={confirmModal.message}
                confirmText="Confirmer"
                cancelText="Mettre à jour"
                type="info"
            />
        </div>
    );
};
