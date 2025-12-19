import React, { useState, useEffect } from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { DepenseForm } from '../../components/depenses/DepenseForm';
import { DepenseList } from '../../components/depenses/DepenseList';
import { TrendingDown, Plus } from 'lucide-react';

export const GestionDepenses: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const { chargerDepenses, getTotalDepenses, getDepensesParCategorie } = useDepenseStore();

  useEffect(() => {
    // Par défaut on charge le mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    chargerDepenses(startOfMonth);
  }, [chargerDepenses]);

  const totalDepenses = getTotalDepenses();
  const parCategorie = getDepensesParCategorie();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Dépenses</h1>
          <p className="text-gray-500">Suivi des coûts d'exploitation (Carburant, Factures...)</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Nouvelle Dépense</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium">Total ce mois</h3>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <TrendingDown size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalDepenses.toLocaleString()} F</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
           <h3 className="text-gray-500 font-medium mb-4">Répartition par catégorie</h3>
           <div className="flex flex-wrap gap-2">
             {Object.entries(parCategorie).map(([cat, montant]) => (
               <div key={cat} className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                 <span className="text-xs font-medium text-gray-500">{cat}</span>
                 <span className="text-sm font-bold text-gray-900">{montant.toLocaleString()}</span>
               </div>
             ))}
             {Object.keys(parCategorie).length === 0 && (
               <p className="text-sm text-gray-400 italic">Aucune donnée</p>
             )}
           </div>
        </div>
      </div>

      {showForm && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-200">
          <DepenseForm onDesc={() => setShowForm(false)} />
        </div>
      )}

      <DepenseList />
    </div>
  );
};
