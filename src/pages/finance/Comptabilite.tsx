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
  ArrowRight,
  RefreshCw,
  Coins
} from 'lucide-react';

export const Comptabilite: React.FC = () => {
  const [periode, setPeriode] = useState<{ mois: number, annee: number }>({
    mois: new Date().getMonth(),
    annee: new Date().getFullYear()
  });

  const [stats, setStats] = useState({
    caBoutique: 0,
    caLivraison: 0,
    consommationMatiere: 0,
    coutDepenses: 0,
    loading: false
  });

  const { getValeurConsommationPeriode, chargerDonnees: chargerStock } = useStockStore();
  const { chargerDepenses, getTotalDepenses } = useDepenseStore();
  const { chargerFactures, factures } = useFacturationStore();
  const { getVentesPeriode } = useBoutiqueStore();

  useEffect(() => {
    chargerDonnees();
  }, [periode]);

  const chargerDonnees = async () => {
    setStats(prev => ({ ...prev, loading: true }));
    
    // Définir les bornes du mois
    const debut = new Date(periode.annee, periode.mois, 1, 0, 0, 0);
    const fin = new Date(periode.annee, periode.mois + 1, 0, 23, 59, 59);

    try {
        console.log("Calcul comptabilité pour la période:", debut.toLocaleString(), "au", fin.toLocaleString());

        // 1. Charge Recettes (CA)
        // CA Boutique
        const caBoutique = await getVentesPeriode(debut, fin);
        
        // CA Livraison (Factures)
        await chargerFactures(debut, fin);
        
        // 2. Charge Coûts
        // Stock: attention chargerStock charge tout, mais c'est nécessaire pour avoir les mouvements
        // Optimisation possible: ne charger que les mouvements de la période si le store le permettait
        await chargerStock(); 
        
        // Dépenses
        await chargerDepenses(debut, fin);

        setStats(prev => ({ ...prev, loading: false, caBoutique })); 
    } catch (e) {
        console.error("Erreur calcul compta:", e);
        setStats(prev => ({ ...prev, loading: false }));
    }
  };

  // Calculs dérivés des stores après mise à jour
  const facturesDuMois = factures.filter(f => {
      if (f.statut === 'annulee') return false;
      const d = new Date(f.dateLivraison); // Comptabilité basée sur les livraisons (fait générateur)
      return d.getMonth() === periode.mois && d.getFullYear() === periode.annee;
  });
  const caLivraison = facturesDuMois.reduce((sum, f) => sum + f.totalTTC, 0);

  // Consommation Stock
  const debut = new Date(periode.annee, periode.mois, 1, 0, 0, 0);
  const fin = new Date(periode.annee, periode.mois + 1, 0, 23, 59, 59);
  const consommationMatiere = getValeurConsommationPeriode(debut, fin);
  
  // Dépenses
  const coutDepenses = getTotalDepenses(); // getTotalDepenses utilise déjà le filtre du store (qui a été chargé avec les dates)

  // Totaux
  const totalRecettes = stats.caBoutique + caLivraison;
  const totalCouts = consommationMatiere + coutDepenses;
  const resultat = totalRecettes - totalCouts;
  const marge = totalRecettes > 0 ? (resultat / totalRecettes) * 100 : 0;

  const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' FCFA';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Comptabilité Analytique</h1>
           <p className="text-gray-500">Vue consolidée des recettes et dépenses</p>
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

            <div className="flex items-center space-x-2 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
                <button 
                    onClick={() => setPeriode(p => ({ ...p, mois: p.mois === 0 ? 11 : p.mois - 1, annee: p.mois === 0 ? p.annee - 1 : p.annee }))}
                    className="p-1 hover:bg-gray-100 rounded"
                >
                    <ArrowRight className="rotate-180" size={20}/>
                </button>
                <span className="font-semibold min-w-[140px] text-center select-none">
                    {MOIS[periode.mois]} {periode.annee}
                </span>
                <button 
                    onClick={() => setPeriode(p => ({ ...p, mois: p.mois === 11 ? 0 : p.mois + 1, annee: p.mois === 11 ? p.annee + 1 : p.annee }))}
                    className="p-1 hover:bg-gray-100 rounded"
                >
                    <ArrowRight size={20}/>
                </button>
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
                <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">Recettes</span>
            </div>
            <div className="space-y-2 relative z-10">
                <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(totalRecettes)}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                    <div className="bg-emerald-50/50 p-2 rounded">
                        <p className="text-emerald-800 text-xs uppercase tracking-wider font-semibold">Boutique</p>
                        <p className="font-medium text-emerald-900">{formatCurrency(stats.caBoutique)}</p>
                    </div>
                    <div className="bg-emerald-50/50 p-2 rounded">
                        <p className="text-emerald-800 text-xs uppercase tracking-wider font-semibold">Livraisons</p>
                        <p className="font-medium text-emerald-900">{formatCurrency(caLivraison)}</p>
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
                <span className="text-sm font-medium text-red-700 bg-red-50 px-3 py-1 rounded-full">Coûts</span>
            </div>
            <div className="space-y-2 relative z-10">
                <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(totalCouts)}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                    <div className="bg-red-50/50 p-2 rounded">
                        <p className="text-red-800 text-xs uppercase tracking-wider font-semibold">Intrants</p>
                        <p className="font-medium text-red-900">{formatCurrency(consommationMatiere)}</p>
                    </div>
                    <div className="bg-red-50/50 p-2 rounded">
                        <p className="text-red-800 text-xs uppercase tracking-wider font-semibold">Dépenses</p>
                        <p className="font-medium text-red-900">{formatCurrency(coutDepenses)}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Résultat */}
        <div className={`bg-white p-6 rounded-xl shadow-sm border relative overflow-hidden ${resultat >= 0 ? 'border-blue-100' : 'border-orange-100'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <Activity size={100} className={resultat >= 0 ? 'text-blue-600' : 'text-orange-600'} />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-3 rounded-lg ${resultat >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <Activity className={resultat >= 0 ? 'text-blue-600' : 'text-orange-600'} size={24} />
                </div>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${resultat >= 0 ? 'text-blue-700 bg-blue-50' : 'text-orange-700 bg-orange-50'}`}>
                    Résultat Net
                </span>
            </div>
            <div className="space-y-2 relative z-10">
                <h3 className={`text-3xl font-bold ${resultat >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    {resultat > 0 ? '+' : ''}{formatCurrency(resultat)}
                </h3>
                <div className="flex items-center justify-between pt-2">
                     <p className="text-sm text-gray-500">Marge Nette</p>
                     <p className={`text-lg font-bold ${marge >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {marge.toFixed(1)}%
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
                <PieChartIcon className="mr-2 text-gray-500" size={20}/>
                Répartition des Coûts
            </h3>
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Intrants (Matières Premières)</span>
                        <span className="font-bold text-gray-900">{totalCouts > 0 ? Math.round((consommationMatiere / totalCouts) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="bg-orange-500 h-3 rounded-full transition-all duration-500" style={{ width: `${totalCouts > 0 ? (consommationMatiere / totalCouts) * 100 : 0}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(consommationMatiere)}</p>
                </div>
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Frais Généraux (Dépenses)</span>
                        <span className="font-bold text-gray-900">{totalCouts > 0 ? Math.round((coutDepenses / totalCouts) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="bg-red-500 h-3 rounded-full transition-all duration-500" style={{ width: `${totalCouts > 0 ? (coutDepenses / totalCouts) * 100 : 0}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(coutDepenses)}</p>
                </div>
            </div>
         </div>

         {/* Structure du CA */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                <Coins className="mr-2 text-gray-500" size={20}/>
                Structure du Chiffre d'Affaires
            </h3>
             <div className="space-y-6">
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Ventes Boutique</span>
                        <span className="font-bold text-gray-900">{totalRecettes > 0 ? Math.round((stats.caBoutique / totalRecettes) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${totalRecettes > 0 ? (stats.caBoutique / totalRecettes) * 100 : 0}%` }}></div>
                    </div>
                     <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(stats.caBoutique)}</p>
                </div>
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Livraisons (Facturées)</span>
                        <span className="font-bold text-gray-900">{totalRecettes > 0 ? Math.round((caLivraison / totalRecettes) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="bg-purple-500 h-3 rounded-full transition-all duration-500" style={{ width: `${totalRecettes > 0 ? (caLivraison / totalRecettes) * 100 : 0}%` }}></div>
                    </div>
                     <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(caLivraison)}</p>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};
