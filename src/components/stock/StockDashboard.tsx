import React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useStockStore } from '../../store/stockStore';
import { useFacturationStore } from '../../store/facturationStore';
import { TrendingUp, TrendingDown, AlertCircle, Package, Calendar } from 'lucide-react';
import { Icon } from '@iconify/react';

export const StockDashboard: React.FC = () => {
  const { matieres, getDepensesPeriode, getValeurConsommationPeriode } = useStockStore();
  
  const { factures, chargerFactures } = useFacturationStore();
  
  // États pour les calculs
  const [ventesBoutiqueTotal, setVentesBoutiqueTotal] = React.useState(0);
  const [isLoadingStats, setIsLoadingStats] = React.useState(true);

  // États pour le filtre de date
  // Par défaut : du 1er du mois en cours à aujourd'hui
  const [dateDebut, setDateDebut] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = React.useState(() => {
    return new Date().toISOString().split('T')[0];
  });


  // Calculs Stock (Valeur à l'instant T, indépendant de la période)
  const valeurTotaleStock = matieres.reduce((sum, m) => sum + m.valeurTotale, 0);

  // Conversion des dates sélectionnées en objets Date
  const startPeriod = new Date(dateDebut);
  startPeriod.setHours(0, 0, 0, 0);
  
  const endPeriod = new Date(dateFin);
  endPeriod.setHours(23, 59, 59, 999);
  
  // Coût des Matières Consommées (COGS) pour la période
  const coutMatieresConsommees = getValeurConsommationPeriode(startPeriod, endPeriod);

  // Dépenses (Cash out) pour la période
  const depensesMois = getDepensesPeriode(startPeriod, endPeriod);

  React.useEffect(() => {
    const fetchData = async () => {
        setIsLoadingStats(true);
        try {
            // 1. Charger les factures de la période
            await chargerFactures(startPeriod, endPeriod);

            // 2. Calculer ventes boutique de la période
            const ventesQuery = query(
                collection(db, 'shopSales'),
                where('date', '>=', startPeriod),
                where('date', '<=', endPeriod)
            );

            const ventesSnapshot = await getDocs(ventesQuery);
            let totalBoutique = 0;

            ventesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.produits && Array.isArray(data.produits)) {
                    const totalJour = data.produits.reduce((acc: number, item: any) => {
                        const prix = item.produit?.prixBoutique || 0;
                        const qte = item.venduTotal || 0;
                        return acc + (prix * qte);
                    }, 0);
                    totalBoutique += totalJour;
                }
            });

            setVentesBoutiqueTotal(totalBoutique);
            
        } catch (error) {
            console.error("Erreur chargement stats:", error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    fetchData();
  }, [dateDebut, dateFin]); // Recharger quand les dates changent

  // Total Ventes = Factures Validées/Payées + Ventes Boutique
  const ventesFactures = factures
    .filter(f => f.statut === 'validee' || f.statut === 'payee' || f.statut === 'envoyee')
    .reduce((sum, f) => sum + f.totalTTC, 0);

  const totalVentes = ventesFactures + ventesBoutiqueTotal;
  
  // MARGE BRUTE = VENTES - COUT MATIERES CONSOMMEES
  const margeBrute = totalVentes - coutMatieresConsommees;
  const tauxMarge = totalVentes > 0 ? (margeBrute / totalVentes) * 100 : 0;

  // Debug pour identifier d'où viennent les données
  React.useEffect(() => {
    console.log('🔍 DEBUG Marge Brute:', {
      'Ventes Factures': ventesFactures,
      'Ventes Boutique': ventesBoutiqueTotal,
      'Total Ventes': totalVentes,
      'Coût Matières Consommées': coutMatieresConsommees,
      'Marge Brute Calculée': margeBrute,
      'Nombre de Factures': factures.length,
      'Factures détail': factures.map(f => ({ id: f.id, statut: f.statut, total: f.totalTTC }))
    });
  }, [totalVentes, coutMatieresConsommees, margeBrute, factures, ventesFactures, ventesBoutiqueTotal]);



  return (
    <>
      {/* Filtre de Date */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Icon icon="mdi:chart-box" className="text-xl" />
            </div>
            <h2 className="font-semibold text-gray-800">Tableau de Bord</h2>
        </div>

        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
                <Calendar size={18} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Période :</span>
            </div>
            <div className="flex items-center gap-2">
                <input 
                    type="date" 
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-1.5"
                />
                <span className="text-gray-400">à</span>
                <input 
                    type="date" 
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-1.5"
                />
            </div>
        </div>
      </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">Valeur totale Stock</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">
              {Math.round(valeurTotaleStock).toLocaleString()} FCFA
            </h3>
            <p className="text-xs text-gray-400 mt-1">(À l'instant T)</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Package size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">Flux de Trésorerie (Achats)</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">
              {Math.round(depensesMois).toLocaleString()} FCFA
            </h3>
            <p className="text-xs text-gray-500 mt-1">Sur la période</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <TrendingDown size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">Coût Production</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1 text-orange-600">
              {Math.round(coutMatieresConsommees).toLocaleString()} FCFA
            </h3>
            <p className="text-xs text-gray-500 mt-1">Matières consommées</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

       <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">Marge Brute (Comptable)</p>
            {isLoadingStats ? (
                 <h3 className="text-2xl font-bold text-gray-300 mt-1 animate-pulse">...</h3>
            ) : (
                <>
                    <h3 className={`text-2xl font-bold mt-1 ${margeBrute >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.round(margeBrute).toLocaleString()} FCFA
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${tauxMarge > 30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {tauxMarge.toFixed(1)}%
                        </span>
                        <p className="text-xs text-gray-500">Ventes - Conso.</p>
                    </div>
                </>
            )}
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>
    </div>


    </>
  );
};
