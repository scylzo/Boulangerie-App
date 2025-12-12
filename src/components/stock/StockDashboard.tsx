import React from 'react';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useStockStore } from '../../store/stockStore';
import { useFacturationStore } from '../../store/facturationStore';
import { TrendingUp, TrendingDown, AlertCircle, Package } from 'lucide-react';

export const StockDashboard: React.FC = () => {
  const { matieres, getDepensesPeriode, getValeurConsommationPeriode } = useStockStore();
  
  const { factures, chargerFactures } = useFacturationStore();
  
  // États pour les calculs
  const [ventesBoutiqueTotal, setVentesBoutiqueTotal] = React.useState(0);
  const [isLoadingStats, setIsLoadingStats] = React.useState(true);

  // Calculs Stock
  const valeurTotaleStock = matieres.reduce((sum, m) => sum + m.valeurTotale, 0);

  // Calculs Période (Mois en cours)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  // Coût des Matières Consommées (COGS) pour le mois
  // C'est ce qu'il faut déduire des ventes pour avoir la Marge Brute
  const coutMatieresConsommees = getValeurConsommationPeriode(startOfMonth, now);

  // On garde aussi les dépenses (Cash out) pour info
  const depensesMois = getDepensesPeriode(startOfMonth, now);

  React.useEffect(() => {
    const fetchMonthlyData = async () => {
        setIsLoadingStats(true);
        try {
            // 1. Charger les factures du mois
            await chargerFactures(startOfMonth, endOfMonth);

            // 2. Calculer ventes boutique du mois
            const ventesQuery = query(
                collection(db, 'shopSales'),
                where('date', '>=', startOfMonth),
                where('date', '<=', endOfMonth)
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

    fetchMonthlyData();
  }, []);

  // Total Ventes = Factures Validées/Payées + Ventes Boutique
  const ventesFactures = factures
    .filter(f => f.statut === 'validee' || f.statut === 'payee' || f.statut === 'envoyee')
    .reduce((sum, f) => sum + f.totalTTC, 0);

  const totalVentes = ventesFactures + ventesBoutiqueTotal;
  
  // MARGE BRUTE = VENTES - COUT MATIERES CONSOMMEES (pas les achats !)
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

  // Fonction de nettoyage pour supprimer les données parasites
  const nettoyerDonnees = async () => {
    if (!confirm('⚠️ Voulez-vous vraiment nettoyer toutes les données de ventes et factures ? Cette action est irréversible.')) {
      return;
    }

    try {
      // 1. Supprimer toutes les factures
      const facturesQuery = query(collection(db, 'factures'));
      const facturesSnapshot = await getDocs(facturesQuery);

      console.log(`🧹 Suppression de ${facturesSnapshot.docs.length} factures...`);
      for (const doc of facturesSnapshot.docs) {
        await deleteDoc(doc.ref);
      }

      // 2. Supprimer toutes les ventes boutique
      const ventesQuery = query(collection(db, 'shopSales'));
      const ventesSnapshot = await getDocs(ventesQuery);

      console.log(`🧹 Suppression de ${ventesSnapshot.docs.length} ventes boutique...`);
      for (const doc of ventesSnapshot.docs) {
        await deleteDoc(doc.ref);
      }

      // 3. Recharger les données
      await chargerFactures(startOfMonth, endOfMonth);
      setVentesBoutiqueTotal(0);

      alert('✅ Nettoyage terminé ! Toutes les données de ventes ont été supprimées.');

    } catch (error) {
      console.error('❌ Erreur lors du nettoyage:', error);
      alert('❌ Erreur lors du nettoyage des données.');
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">Valeur totale Stock</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">
              {Math.round(valeurTotaleStock).toLocaleString()} FCFA
            </h3>
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
            <p className="text-xs text-gray-500 mt-1">Achats du mois</p>
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

    {/* Bouton de nettoyage temporaire */}
    {(margeBrute !== 0 || totalVentes !== 0 || coutMatieresConsommees !== 0) && (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-red-800">🧹 Nettoyage des données</h4>
            <p className="text-xs text-red-600">
              Des données parasites affectent le calcul de la marge brute.
              Vous pouvez les supprimer si elles ne correspondent pas à de vraies ventes.
            </p>
          </div>
          <button
            onClick={nettoyerDonnees}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Nettoyer les données
          </button>
        </div>
      </div>
    )}
    </>
  );
};
