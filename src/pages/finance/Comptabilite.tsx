import React, { useState, useEffect } from 'react';
import { useStockStore } from '../../store/stockStore';
import { useDepenseStore } from '../../store/depenseStore';
import { useFacturationStore } from '../../store/facturationStore';
import { useBoutiqueStore } from '../../store/boutiqueStore';
import {
    TrendingUp,
    TrendingDown,
    PieChart as PieChartIcon,
    Activity,
    RefreshCw,
    Coins,
    Calendar
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
        caLivraison: 0,
        totalRecettes: 0,
        totalCouts: 0,
        achatsMatieres: 0,
        autresCharges: 0,
        resultat: 0,
        marge: 0,
        depensesParCategorie: {} as Record<string, number>,
        loading: false
    });

    const { chargerDonnees: chargerStock } = useStockStore();
    const { chargerDepenses, getTotalDepenses, getDepensesParCategorie, depenses } = useDepenseStore();
    const { chargerFactures, factures } = useFacturationStore();
    const { getVentesPeriode } = useBoutiqueStore();

    // Charger les données au montage et quand la période change
    useEffect(() => {
        chargerDonnees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periode.debut, periode.fin]);

    // Recalculer les stats quand les données des stores changent
    useEffect(() => {
        calculerStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [factures, depenses, periode.debut, periode.fin]);

    const chargerDonnees = async () => {
        setStats(prev => ({ ...prev, loading: true }));

        // Définir les bornes (début de journée au début, fin de journée à la fin)
        const debut = new Date(periode.debut);
        debut.setHours(0, 0, 0, 0);

        const fin = new Date(periode.fin);
        fin.setHours(23, 59, 59, 999);

        try {
            console.log("Calcul comptabilité pour la période:", debut.toLocaleString(), "au", fin.toLocaleString());

            // Charger toutes les données en parallèle
            const [caBoutique] = await Promise.all([
                getVentesPeriode(debut, fin),
                chargerFactures(debut, fin),
                chargerDepenses(debut, fin),
                chargerStock()
            ]);

            setStats(prev => ({ ...prev, loading: false, caBoutique }));
        } catch (e) {
            console.error("Erreur calcul compta:", e);
            setStats(prev => ({ ...prev, loading: false }));
        }
    };

    const calculerStats = () => {
        // Définir les bornes pour le filtrage
        const debut = new Date(periode.debut);
        debut.setHours(0, 0, 0, 0);
        const fin = new Date(periode.fin);
        fin.setHours(23, 59, 59, 999);

        // Calculs dérivés des stores après mise à jour
        const facturesDuMois = factures.filter(f => {
            if (f.statut === 'annulee') return false;
            const d = new Date(f.dateLivraison);
            return d >= debut && d <= fin;
        });
        const caLivraison = facturesDuMois.reduce((sum, f) => sum + f.totalTTC, 0);

        // COUTS (Basé sur les Dépenses Réelles / Trésorerie)
        const totalDepenses = getTotalDepenses();

        // On isole les "Intrants" (Achats Matières) des autres charges pour l'analyse
        const depensesParCategorie = getDepensesParCategorie();
        const achatsMatieres = depensesParCategorie['Intrants'] || 0;
        const autresCharges = totalDepenses - achatsMatieres;

        // Totaux
        const totalRecettes = stats.caBoutique + caLivraison;
        const totalCouts = totalDepenses;
        const resultat = totalRecettes - totalCouts;
        const marge = totalRecettes > 0 ? (resultat / totalRecettes) * 100 : 0;

        setStats(prev => ({
            ...prev,
            caLivraison,
            totalRecettes,
            totalCouts,
            achatsMatieres,
            autresCharges,
            resultat,
            marge,
            depensesParCategorie
        }));
    };



    const formatCurrency = (amount: number) => {
        return Math.round(amount).toLocaleString('fr-FR') + ' FCFA';
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
                    <p className="text-gray-500">Recettes - Dépenses = Résultat (Trésorerie)</p>
                </div>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={chargerDonnees}
                        disabled={stats.loading}
                        className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Actualiser les données"
                    >
                        <RefreshCw size={20} className={stats.loading ? "animate-spin" : ""} />
                    </button>

                    <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Période :</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={periode.debut}
                                onChange={(e) => setPeriode(p => ({ ...p, debut: e.target.value }))}
                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-1.5"
                            />
                            <span className="text-gray-400">à</span>
                            <input
                                type="date"
                                value={periode.fin}
                                onChange={(e) => setPeriode(p => ({ ...p, fin: e.target.value }))}
                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-1.5"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Recettes */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp size={100} className="text-emerald-600" />
                    </div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-emerald-50 rounded-lg">
                            <TrendingUp className="text-emerald-600" size={24} />
                        </div>
                        <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">Recettes (Entrées)</span>
                    </div>
                    <div className="space-y-2 relative z-10">
                        <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalRecettes)}</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                            <div className="bg-emerald-50/50 p-2 rounded">
                                <p className="text-emerald-800 text-xs uppercase tracking-wider font-semibold">Boutique</p>
                                <p className="font-medium text-emerald-900">{formatCurrency(stats.caBoutique)}</p>
                            </div>
                            <div className="bg-emerald-50/50 p-2 rounded">
                                <p className="text-emerald-800 text-xs uppercase tracking-wider font-semibold">Livraisons</p>
                                <p className="font-medium text-emerald-900">{formatCurrency(stats.caLivraison)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coûts */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingDown size={100} className="text-red-600" />
                    </div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-red-50 rounded-lg">
                            <TrendingDown className="text-red-600" size={24} />
                        </div>
                        <span className="text-sm font-medium text-red-700 bg-red-50 px-3 py-1 rounded-full">Dépenses (Sorties)</span>
                    </div>
                    <div className="space-y-2 relative z-10">
                        <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalCouts)}</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                            <div className="bg-red-50/50 p-2 rounded">
                                <p className="text-red-800 text-xs uppercase tracking-wider font-semibold">Achats Matières</p>
                                <p className="font-medium text-red-900">{formatCurrency(stats.achatsMatieres)}</p>
                            </div>
                            <div className="bg-red-50/50 p-2 rounded">
                                <p className="text-red-800 text-xs uppercase tracking-wider font-semibold">Autres Charges</p>
                                <p className="font-medium text-red-900">{formatCurrency(stats.autresCharges)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Résultat */}
                <div className={`bg-white p-6 rounded-xl shadow-sm border relative overflow-hidden ${stats.resultat >= 0 ? 'border-blue-100' : 'border-orange-100'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Activity size={100} className={stats.resultat >= 0 ? 'text-blue-600' : 'text-orange-600'} />
                    </div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className={`p-3 rounded-lg ${stats.resultat >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                            <Activity className={stats.resultat >= 0 ? 'text-blue-600' : 'text-orange-600'} size={24} />
                        </div>
                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${stats.resultat >= 0 ? 'text-blue-700 bg-blue-50' : 'text-orange-700 bg-orange-50'}`}>
                            Résultat Net
                        </span>
                    </div>
                    <div className="space-y-2 relative z-10">
                        <h3 className={`text-3xl font-bold ${stats.resultat >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                            {stats.resultat > 0 ? '+' : ''}{formatCurrency(stats.resultat)}
                        </h3>
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-sm text-gray-500">Marge Nette</p>
                            <p className={`text-lg font-bold ${stats.marge >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                {stats.marge.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Détails */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Graphique de répartition des Coûts */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                        <PieChartIcon className="mr-2 text-gray-500" size={20} />
                        Répartition des Charges
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Matières Premières (Intrants)</span>
                                <span className="font-bold text-gray-900">{stats.totalCouts > 0 ? Math.round((stats.achatsMatieres / stats.totalCouts) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-orange-500 h-3 rounded-full transition-all duration-500" style={{ width: `${stats.totalCouts > 0 ? (stats.achatsMatieres / stats.totalCouts) * 100 : 0}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(stats.achatsMatieres)}</p>
                        </div>
                        {Object.entries(stats.depensesParCategorie).map(([categ, montant]) => {
                            if (categ === 'Intrants' || montant === 0) return null;
                            return (
                                <div key={categ}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-600">{categ}</span>
                                        <span className="font-bold text-gray-900">{stats.totalCouts > 0 ? Math.round(((montant as number) / stats.totalCouts) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3">
                                        <div className="bg-slate-500 h-3 rounded-full transition-all duration-500" style={{ width: `${stats.totalCouts > 0 ? ((montant as number) / stats.totalCouts) * 100 : 0}%` }}></div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(montant as number)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Structure du CA */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                        <Coins className="mr-2 text-gray-500" size={20} />
                        Sources de Revenus
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Ventes Boutique</span>
                                <span className="font-bold text-gray-900">{stats.totalRecettes > 0 ? Math.round((stats.caBoutique / stats.totalRecettes) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${stats.totalRecettes > 0 ? (stats.caBoutique / stats.totalRecettes) * 100 : 0}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(stats.caBoutique)}</p>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Livraisons (Facturées)</span>
                                <span className="font-bold text-gray-900">{stats.totalRecettes > 0 ? Math.round((stats.caLivraison / stats.totalRecettes) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-purple-500 h-3 rounded-full transition-all duration-500" style={{ width: `${stats.totalRecettes > 0 ? (stats.caLivraison / stats.totalRecettes) * 100 : 0}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(stats.caLivraison)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
