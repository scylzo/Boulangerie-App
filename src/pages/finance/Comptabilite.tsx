import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState, useEffect } from 'react';
import { useStockStore } from '../../store/stockStore';
import { useDepenseStore } from '../../store/depenseStore';
import { useFacturationStore } from '../../store/facturationStore';
import { useBoutiqueStore } from '../../store/boutiqueStore';
import { usePosStore } from '../../store/posStore';
import { DonutChart } from '../../components/ui';
import {
    TrendingUp,
    TrendingDown,
    PieChart as PieChartIcon,
    Activity,
    RefreshCw,
    Coins,
    Calendar,
    FileText
} from 'lucide-react';


export const Comptabilite: React.FC = () => {
    const [periode, setPeriode] = useState<{ debut: string, fin: string }>(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            debut: startOfMonth.toISOString().split('T')[0],
            fin: now.toISOString().split('T')[0]
        };
    });

    const [stats, setStats] = useState({
        caBoutique: 0,
        caPos: 0,
        caLivraison: 0,
        achatsMatieres: 0,
        autresCharges: 0,
        totalCouts: 0,
        depensesParCategorie: {} as Record<string, number>,
        detailMatieres: {} as Record<string, number>,
        loading: false
    });

    const { chargerDepenses, getDepensesProRata, depenses } = useDepenseStore();
    const { chargerFactures, factures } = useFacturationStore();
    const { getVentesPeriode } = useBoutiqueStore();
    const { getVentesPeriode: getVentesPos } = usePosStore();
    const { chargerDonnees: chargerStock, mouvements, matieres } = useStockStore();

    // Charger les données au montage et quand la période change
    useEffect(() => {
        chargerDonnees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periode.debut, periode.fin]);

    // Recalculer les stats quand les données des stores changent
    useEffect(() => {
        calculerStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [factures, depenses, mouvements, matieres, periode.debut, periode.fin]);

    // Calculs dérivés pour l'affichage (garantit la cohérence)
    const totalRecettes = stats.caBoutique + stats.caPos + stats.caLivraison;
    const resultat = totalRecettes - stats.totalCouts;
    const marge = totalRecettes > 0 ? (resultat / totalRecettes) * 100 : 0;

    const chargerDonnees = async () => {
        setStats(prev => ({ ...prev, loading: true }));

        const debut = new Date(periode.debut);
        debut.setHours(0, 0, 0, 0);

        const fin = new Date(periode.fin);
        fin.setHours(23, 59, 59, 999);

        try {
            console.log("Calcul comptabilité pour la période:", debut.toLocaleString(), "au", fin.toLocaleString());

            const [caBoutique, , , , caPos] = await Promise.all([
                getVentesPeriode(debut, fin),
                chargerFactures(debut, fin),
                chargerDepenses(debut, fin),
                chargerStock(),
                getVentesPos(debut, fin)
            ]);

            setStats(prev => ({ ...prev, loading: false, caBoutique, caPos }));
        } catch (e) {
            console.error("Erreur calcul compta:", e);
            setStats(prev => ({ ...prev, loading: false }));
        }
    };

    const calculerStats = () => {
        const debut = new Date(periode.debut);
        debut.setHours(0, 0, 0, 0);
        const fin = new Date(periode.fin);
        fin.setHours(23, 59, 59, 999);

        // 1. REVENUS LIVRAISON (Facturés)
        const facturesDuMois = factures.filter(f => {
            if (f.statut === 'annulee') return false;
            const d = new Date(f.dateLivraison);
            return d >= debut && d <= fin;
        });

        const facturesUniquesMap = new Map<string, typeof factures[0]>();
        facturesDuMois.forEach(f => {
            const dayKey = new Date(f.dateLivraison).toISOString().split('T')[0];
            const key = `${f.clientId}_${dayKey}`;

            if (!facturesUniquesMap.has(key)) {
                facturesUniquesMap.set(key, f);
            } else {
                const existing = facturesUniquesMap.get(key)!;
                const getScore = (statut: string) => {
                    switch (statut) {
                        case 'payee': return 5;
                        case 'envoyee': return 4;
                        case 'validee': return 3;
                        case 'en_attente_retours': return 2;
                        default: return 1;
                    }
                };
                const scoreNew = getScore(f.statut);
                const scoreExist = getScore(existing.statut);
                if (scoreNew > scoreExist) {
                    facturesUniquesMap.set(key, f);
                } else if (scoreNew === scoreExist) {
                    if (new Date(f.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                        facturesUniquesMap.set(key, f);
                    }
                }
            }
        });

        const facturesNettoyees = Array.from(facturesUniquesMap.values());
        const caLivraison = facturesNettoyees.reduce((sum, f) => sum + f.totalTTC, 0);


        // 2. COUTS : MATIÈRES CONSOMMÉES (Comptabilité Analytique)
        // On ne regarde plus les factures d'achat ('Intrants'), mais la consommation réelle.
        let coutMatieresConsommees = 0;
        const detailMatieresTemp: Record<string, number> = {};

        mouvements.forEach(mvt => {
            const dateMvt = new Date(mvt.date);
            if (dateMvt >= debut && dateMvt <= fin && mvt.type === 'consommation') {
                // Trouver le prix unitaire moyen de la matière
                // Note: Idéalement le PMP devrait être historisé dans le mouvement pour exactitude parfaite
                // Ici on prend le PMP actuel (approximation acceptable pour PME)
                const matiere = matieres.find(m => m.id === mvt.matiereId);
                if (matiere && matiere.prixUnitaireMoyen) {
                    // mvt.quantite est positif dans la BDD pour 'consommation' via addMouvement ?
                    // Vérif: addMouvement stock signedQuantity dans 'newStock' calcul, mais enregistre 'mouvementData.quantite' tel quel.
                    // Dans MouvementModal, onSubmit passe 'quantite' tjrs positive. 
                    // Donc on prend mvt.quantite * PMP
                    const cout = (Math.abs(mvt.quantite) * matiere.prixUnitaireMoyen);
                    coutMatieresConsommees += cout;

                    if (detailMatieresTemp[matiere.nom]) {
                        detailMatieresTemp[matiere.nom] += cout;
                    } else {
                        detailMatieresTemp[matiere.nom] = cout;
                    }
                }
            }
        });


        // 3. COUTS : CHARGES EXTERNES (Dépenses Classiques)
        // On exclut strictement la catégorie 'Intrants' car elle est gérée par le stock ci-dessus
        // On exclut aussi 'Carburant Four' s'il est géré en stock maintenant.
        // La logique utilisateur est "plus de dépense intrant". Donc on filtre tout ce qui est Intrant.
        const statsCouts = getDepensesProRata(debut, fin);
        const depensesParCategorie = { ...statsCouts.parCategorie };

        // SUPPRESSION DES INTRANTS des Dépenses pour éviter doublon
        // Si l'utilisateur a quand même saisi des intrants dans "Dépenses", on les ignore ici pour la Marge sur Prod.
        const { Intrants: _ignored, ...depensesFiltrees } = depensesParCategorie;

        const totalChargesExternes = Object.values(depensesFiltrees).reduce((acc, curr) => acc + curr, 0);

        // TOTAL COUTS = MATIERES + CHARGES
        const totalCouts = coutMatieresConsommees + totalChargesExternes;


        setStats(prev => ({
            ...prev,
            caLivraison,
            totalCouts,
            achatsMatieres: coutMatieresConsommees, // On remplace sémantiquement "Achats" par "Consommation"
            autresCharges: totalChargesExternes,
            depensesParCategorie: depensesFiltrees,
            detailMatieres: detailMatieresTemp
        }));
    };



    const formatCurrency = (amount: number) => {
        return Math.round(amount).toLocaleString('fr-FR') + ' FCFA';
    };

    const genererRapportPDF = () => {
        const doc = new jsPDF();

        // Helper pour le formatage propre dans le PDF
        const formatPdfCurrency = (amount: number) => {
            return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ' FCFA';
        };

        // --- EN-TÊTE ---
        // Fond coloré pour l'en-tête
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, 210, 40, 'F');

        // Titre blanc
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("RAPPORT FINANCIER", 105, 20, { align: 'center' }); // Centré

        // Période et Date en blanc légèrement transparent
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "normal");
        doc.text(`Période : ${new Date(periode.debut).toLocaleDateString('fr-FR')} au ${new Date(periode.fin).toLocaleDateString('fr-FR')}`, 105, 30, { align: 'center' });

        const generatedDate = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
        doc.setFontSize(8);
        doc.text(generatedDate, 200, 38, { align: 'right' });


        // --- CONTENU ---
        let finalY = 50;

        // 1. RÉSUMÉ FINANCIER
        doc.setFontSize(14);
        doc.setTextColor(41, 128, 185);
        doc.setFont("helvetica", "bold");
        doc.text("1. Synthèse Financière", 14, finalY);

        const summaryData = [
            ['Total Recettes', formatPdfCurrency(totalRecettes)],
            ['Total Dépenses', formatPdfCurrency(stats.totalCouts)],
            ['RÉSULTAT NET', formatPdfCurrency(resultat)],
            ['Marge Nette', `${marge.toFixed(1)} %`]
        ];

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Indicateur', 'Montant / Valeur']],
            body: summaryData,
            theme: 'striped',
            headStyles: {
                fillColor: [44, 62, 80],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 100 },
                1: { halign: 'right', fontStyle: 'bold' } // Alignement à droite pour les chiffres
            },
            styles: { fontSize: 11, cellPadding: 4 },
            didParseCell: function (data) {
                // Mettre en évidence le Résultat Net
                if (data.row.index === 2 && data.section === 'body') {
                    data.cell.styles.textColor = resultat >= 0 ? [39, 174, 96] : [192, 57, 43]; // Vert ou Rouge
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;

        // 2. DÉTAIL DES RECETTES
        doc.setFontSize(14);
        doc.setTextColor(41, 128, 185); // Bleu
        doc.text("2. Détail des Recettes", 14, finalY);

        const recetteData = [
            ['Ventes Boutique', formatPdfCurrency(stats.caBoutique)],
            ['Ventes Caisse (POS)', formatPdfCurrency(stats.caPos)],
            ['Livraisons (Facturées)', formatPdfCurrency(stats.caLivraison)],
            ['TOTAL RECETTES', formatPdfCurrency(totalRecettes)] // Ajout ligne total
        ];

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Source', 'Montant']],
            body: recetteData,
            theme: 'grid',
            headStyles: { fillColor: [39, 174, 96], halign: 'left' }, // Vert
            columnStyles: {
                0: { cellWidth: 100 },
                1: { halign: 'right' }
            },
            didParseCell: function (data) {
                if (data.row.index === recetteData.length - 1 && data.section === 'body') {
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;

        // 3. DÉTAIL DES DÉPENSES
        doc.setFontSize(14);
        doc.setTextColor(192, 57, 43); // Rouge
        doc.text("3. Détail des Dépenses", 14, finalY);

        // Fusionner dépenses classiques et matières premières détaillées
        const allDepenses = [
            ...Object.entries(stats.depensesParCategorie).map(([nom, montant]) => ({ nom, montant })),
            ...Object.entries(stats.detailMatieres).map(([nom, montant]) => ({ nom: `${nom} (Intrant)`, montant }))
        ];

        // Trier par montant décroissant et mapper pour le tableau
        const depenseData = allDepenses
            .filter(d => d.montant > 0)
            .sort((a, b) => b.montant - a.montant)
            .map(d => [d.nom, formatPdfCurrency(d.montant)]);

        // Ajouter le total à la fin
        depenseData.push(['TOTAL DÉPENSES', formatPdfCurrency(stats.totalCouts)]);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Catégorie', 'Montant']],
            body: depenseData,
            theme: 'grid',
            headStyles: { fillColor: [192, 57, 43], halign: 'left' }, // Rouge
            columnStyles: {
                0: { cellWidth: 100 },
                1: { halign: 'right' }
            },
            didParseCell: function (data) {
                // Mettre le total en gras
                if (data.row.index === depenseData.length - 1 && data.section === 'body') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [253, 237, 236]; // Fond rouge très clair
                }
            }
        });

        // --- PIED DE PAGE ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} / ${pageCount}`, 105, 290, { align: 'center' });
            doc.text("Boulangerie App - Document confidentiel", 14, 290, { align: 'left' });
        }

        doc.save(`Rapport_Financier_${periode.debut}_${periode.fin}.pdf`);
    };

    return (
        <div className="min-h-screen bg-sand-100 overflow-x-hidden">
            {/* Header */}
            <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center shrink-0">
                            <Coins className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg sm:text-xl font-semibold text-sand-900 truncate">Comptabilité</h1>
                            <p className="text-xs sm:text-sm text-sand-500 truncate">Recettes - Dépenses = Résultat (Trésorerie)</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                        <button
                            onClick={genererRapportPDF}
                            disabled={stats.loading}
                            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-colors shadow-sm text-xs sm:text-sm font-medium disabled:opacity-50"
                            title="Télécharger le rapport PDF"
                        >
                            <FileText size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span>Générer Rapport</span>
                        </button>

                        <button
                            onClick={chargerDonnees}
                            disabled={stats.loading}
                            className="p-2 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
                            title="Actualiser les données"
                        >
                            <RefreshCw size={18} className={`sm:w-5 sm:h-5 ${stats.loading ? "animate-spin" : ""}`} />
                        </button>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-sand-50 p-2 rounded-lg border border-sand-200">
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-sand-500 sm:w-[18px] sm:h-[18px]" />
                                <span className="text-xs sm:text-sm font-medium text-sand-700">Période :</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={periode.debut}
                                    onChange={(e) => setPeriode(p => ({ ...p, debut: e.target.value }))}
                                    className="bg-white border border-sand-300 text-sand-900 text-xs sm:text-sm rounded-md focus:ring-sand-900 focus:border-sand-900 block p-1.5 w-full sm:w-auto"
                                />
                                <span className="text-sand-400 text-xs sm:text-sm">à</span>
                                <input
                                    type="date"
                                    value={periode.fin}
                                    onChange={(e) => setPeriode(p => ({ ...p, fin: e.target.value }))}
                                    className="bg-white border border-sand-300 text-sand-900 text-xs sm:text-sm rounded-md focus:ring-sand-900 focus:border-sand-900 block p-1.5 w-full sm:w-auto"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contenu principal */}
            <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                    {/* Recettes */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                            <div className="w-11 h-11 bg-success-50 rounded-full flex items-center justify-center">
                                <TrendingUp className="text-success-600" size={20} />
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium text-success-700 bg-success-50 px-2 sm:px-3 py-1 rounded-full truncate">Recettes</span>
                        </div>
                        <div className="space-y-2 relative z-10">
                            <h3 className="font-display text-2xl sm:text-3xl font-semibold tabular-nums text-sand-900 truncate">{formatCurrency(totalRecettes)}</h3>
                            <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm pt-2">
                                <div className="bg-success-50/50 p-2 rounded">
                                    <p className="text-success-700 text-[10px] sm:text-xs uppercase tracking-wider font-semibold truncate">Boutique</p>
                                    <p className="font-medium text-success-700 truncate">{formatCurrency(stats.caBoutique)}</p>
                                </div>
                                <div className="bg-success-50/50 p-2 rounded">
                                    <p className="text-success-700 text-[10px] sm:text-xs uppercase tracking-wider font-semibold truncate">Caisse</p>
                                    <p className="font-medium text-success-700 truncate">{formatCurrency(stats.caPos)}</p>
                                </div>
                                <div className="bg-success-50/50 p-2 rounded">
                                    <p className="text-success-700 text-[10px] sm:text-xs uppercase tracking-wider font-semibold truncate">Livraisons</p>
                                    <p className="font-medium text-success-700 truncate">{formatCurrency(stats.caLivraison)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Coûts */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                            <div className="w-11 h-11 bg-danger-50 rounded-full flex items-center justify-center">
                                <TrendingDown className="text-danger-600" size={20} />
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium text-danger-700 bg-danger-50 px-2 sm:px-3 py-1 rounded-full truncate">Dépenses</span>
                        </div>
                        <div className="space-y-2 relative z-10">
                            <h3 className="font-display text-2xl sm:text-3xl font-semibold tabular-nums text-sand-900 truncate">{formatCurrency(stats.totalCouts)}</h3>
                            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm pt-2">
                                <div className="bg-danger-50/50 p-2 rounded">
                                    <p className="text-danger-700 text-[10px] sm:text-xs uppercase tracking-wider font-semibold truncate">Matières</p>
                                    <p className="font-medium text-danger-700 truncate">{formatCurrency(stats.achatsMatieres)}</p>
                                </div>
                                <div className="bg-danger-50/50 p-2 rounded">
                                    <p className="text-danger-700 text-[10px] sm:text-xs uppercase tracking-wider font-semibold truncate">Charges</p>
                                    <p className="font-medium text-danger-700 truncate">{formatCurrency(stats.autresCharges)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Résultat */}
                    <div className={`bg-white p-5 sm:p-6 rounded-2xl shadow-card border relative overflow-hidden ${resultat >= 0 ? 'border-sand-200' : 'border-sand-200'}`}>
                        <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center ${resultat >= 0 ? 'bg-info-50' : 'bg-warning-50'}`}>
                                <Activity className={resultat >= 0 ? 'text-info-600' : 'text-warning-600'} size={20} />
                            </div>
                            <span className={`text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-full truncate ${resultat >= 0 ? 'text-info-600 bg-info-50' : 'text-warning-600 bg-warning-50'}`}>
                                Résultat Net
                            </span>
                        </div>
                        <div className="space-y-2 relative z-10">
                            <h3 className={`font-display text-2xl sm:text-3xl font-semibold tabular-nums truncate ${resultat >= 0 ? 'text-info-600' : 'text-warning-600'}`}>
                                {resultat > 0 ? '+' : ''}{formatCurrency(resultat)}
                            </h3>
                            <div className="flex items-center justify-between pt-2">
                                <p className="text-xs sm:text-sm text-sand-500">Marge Nette</p>
                                <p className={`text-base sm:text-lg font-semibold ${marge >= 0 ? 'text-info-600' : 'text-warning-600'}`}>
                                    {marge.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Détails */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Graphique de répartition des Coûts */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200">
                        <h3 className="text-base sm:text-lg font-semibold text-sand-800 mb-4 sm:mb-6 flex items-center">
                            <PieChartIcon className="mr-2 text-sand-500" size={18} />
                            <span className="truncate">Répartition des Charges</span>
                        </h3>
                        {(() => {
                            const palette = ['text-sand-900', 'text-gold-500', 'text-sand-500', 'text-warning-500', 'text-sand-400', 'text-gold-600', 'text-sand-300'];
                            let i = 0;
                            const slices: { label: string; value: number; className: string }[] = [];
                            if (stats.achatsMatieres > 0) slices.push({ label: 'Matières premières', value: stats.achatsMatieres, className: palette[i++ % palette.length] });
                            Object.entries(stats.depensesParCategorie).forEach(([categ, montant]) => {
                                if (categ === 'Intrants' || !montant) return;
                                slices.push({ label: categ, value: montant as number, className: palette[i++ % palette.length] });
                            });
                            if (slices.length === 0) return null;
                            return (
                                <div className="flex flex-col sm:flex-row items-center gap-5 mb-6 pb-6 border-b border-sand-100">
                                    <DonutChart
                                        data={slices}
                                        size={140}
                                        stroke={20}
                                        centerValue={<span className="text-sm">{Math.round(stats.totalCouts).toLocaleString('fr-FR')}</span>}
                                        centerLabel="FCFA"
                                    />
                                    <div className="flex-1 w-full space-y-1.5">
                                        {slices.map((s, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs">
                                                <span className={`w-2.5 h-2.5 rounded-full bg-current ${s.className} shrink-0`}></span>
                                                <span className="text-sand-600 truncate flex-1">{s.label}</span>
                                                <span className="text-sand-900 font-medium tabular-nums shrink-0">{stats.totalCouts > 0 ? Math.round((s.value / stats.totalCouts) * 100) : 0}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="space-y-4 sm:space-y-6">
                            {/* Détail des Matières Premières */}
                            {Object.keys(stats.detailMatieres).length > 0 ? (
                                Object.entries(stats.detailMatieres)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([nom, montant]) => (
                                        <div key={nom}>
                                            <div className="flex justify-between text-xs sm:text-sm mb-2">
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className="text-sand-600 truncate">{nom}</span>
                                                    <span className="text-[10px] bg-warning-50 text-warning-600 px-1.5 py-0.5 rounded-full font-medium border border-warning-100 shrink-0">Intrant</span>
                                                </div>
                                                <span className="font-semibold text-sand-900 shrink-0 ml-2">{stats.totalCouts > 0 ? Math.round((montant / stats.totalCouts) * 100) : 0}%</span>
                                            </div>
                                            <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                                <div className="bg-warning-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${stats.totalCouts > 0 ? (montant / stats.totalCouts) * 100 : 0}%` }}></div>
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(montant)}</p>
                                        </div>
                                    ))
                            ) : (
                                <div>
                                    <div className="flex justify-between text-xs sm:text-sm mb-2">
                                        <span className="text-sand-600 truncate">Matières Premières</span>
                                        <span className="font-semibold text-sand-900 shrink-0">{stats.totalCouts > 0 ? Math.round((stats.achatsMatieres / stats.totalCouts) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                        <div className="bg-warning-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${stats.totalCouts > 0 ? (stats.achatsMatieres / stats.totalCouts) * 100 : 0}%` }}></div>
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(stats.achatsMatieres)}</p>
                                </div>
                            )}
                            {Object.entries(stats.depensesParCategorie).map(([categ, montant]) => {
                                if (categ === 'Intrants' || montant === 0) return null;
                                return (
                                    <div key={categ}>
                                        <div className="flex justify-between text-xs sm:text-sm mb-2">
                                            <span className="text-sand-600 truncate">{categ}</span>
                                            <span className="font-semibold text-sand-900 shrink-0">{stats.totalCouts > 0 ? Math.round(((montant as number) / stats.totalCouts) * 100) : 0}%</span>
                                        </div>
                                        <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                            <div className="bg-sand-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${stats.totalCouts > 0 ? ((montant as number) / stats.totalCouts) * 100 : 0}%` }}></div>
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(montant as number)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Structure du CA */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200">
                        <h3 className="text-base sm:text-lg font-semibold text-sand-800 mb-4 sm:mb-6 flex items-center">
                            <Coins className="mr-2 text-sand-500" size={18} />
                            <span className="truncate">Sources de Revenus</span>
                        </h3>
                        <div className="space-y-4 sm:space-y-6">
                            <div>
                                <div className="flex justify-between text-xs sm:text-sm mb-2">
                                    <span className="text-sand-600 truncate">Ventes Boutique</span>
                                    <span className="font-semibold text-sand-900 shrink-0">{totalRecettes > 0 ? Math.round((stats.caBoutique / totalRecettes) * 100) : 0}%</span>
                                </div>
                                <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                    <div className="bg-info-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${totalRecettes > 0 ? (stats.caBoutique / totalRecettes) * 100 : 0}%` }}></div>
                                </div>
                                <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(stats.caBoutique)}</p>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs sm:text-sm mb-2">
                                    <span className="text-sand-600 truncate">Caisse (POS)</span>
                                    <span className="font-semibold text-sand-900 shrink-0">{totalRecettes > 0 ? Math.round((stats.caPos / totalRecettes) * 100) : 0}%</span>
                                </div>
                                <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                    <div className="bg-gold-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${totalRecettes > 0 ? (stats.caPos / totalRecettes) * 100 : 0}%` }}></div>
                                </div>
                                <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(stats.caPos)}</p>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs sm:text-sm mb-2">
                                    <span className="text-sand-600 truncate">Livraisons (Facturées)</span>
                                    <span className="font-semibold text-sand-900 shrink-0">{totalRecettes > 0 ? Math.round((stats.caLivraison / totalRecettes) * 100) : 0}%</span>
                                </div>
                                <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                    <div className="bg-terracotta-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${totalRecettes > 0 ? (stats.caLivraison / totalRecettes) * 100 : 0}%` }}></div>
                                </div>
                                <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(stats.caLivraison)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
