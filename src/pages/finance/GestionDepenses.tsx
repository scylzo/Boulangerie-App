import React, { useState, useEffect } from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { DepenseForm } from '../../components/depenses/DepenseForm';
import { DepenseList } from '../../components/depenses/DepenseList';
import { FournisseurList } from '../../components/stock/FournisseurList';
import { TrendingDown, Plus, Users, Wallet } from 'lucide-react';
import type { Depense } from '../../types/depense';

export const GestionDepenses: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'depenses' | 'fournisseurs'>('depenses');
  const [showForm, setShowForm] = useState(false);
  const [editingDepense, setEditingDepense] = useState<Depense | null>(null);
  const [dateFilter, setDateFilter] = useState({
    debut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0]
  });

  const { chargerDepenses, getTotalDepenses, getDepensesParCategorie, getDepensesProRata } = useDepenseStore();

  useEffect(() => {
    if (dateFilter.debut && dateFilter.fin) {
      chargerDepenses(new Date(dateFilter.debut), new Date(dateFilter.fin));
    }
  }, [chargerDepenses, dateFilter.debut, dateFilter.fin]);

  let totalDepenses = getTotalDepenses();
  let parCategorie = getDepensesParCategorie();

  // Si on filtre par date, on utilise le calcul au prorata pour plus de précision
  if (dateFilter.debut && dateFilter.fin) {
    const statsProrata = getDepensesProRata(new Date(dateFilter.debut), new Date(dateFilter.fin));
    totalDepenses = statsProrata.total;
    parCategorie = statsProrata.parCategorie;
  }

  const handleEditDepense = (depense: Depense) => {
    setEditingDepense(depense);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDepense(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Dépenses</h1>
          <p className="text-gray-500">Suivi des coûts d'exploitation et gestion des fournisseurs</p>
        </div>
        {activeTab === 'depenses' && (
          <button
            onClick={() => {
              setEditingDepense(null);
              setShowForm(!showForm);
            }}
            className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Nouvelle Dépense</span>
          </button>
        )}
      </div>

      {activeTab === 'depenses' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 font-medium">Total ce mois</h3>
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <TrendingDown size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalDepenses.toLocaleString()} FCFA</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h3 className="text-gray-500 font-medium">Répartition par catégorie</h3>
              <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                <input
                  type="date"
                  value={dateFilter.debut}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, debut: e.target.value }))}
                  className="bg-white border border-gray-300 text-gray-900 text-xs rounded px-2 py-1 outline-none focus:border-orange-500"
                />
                <span className="text-gray-400 text-xs">au</span>
                <input
                  type="date"
                  value={dateFilter.fin}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, fin: e.target.value }))}
                  className="bg-white border border-gray-300 text-gray-900 text-xs rounded px-2 py-1 outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(parCategorie).map(([cat, montant]) => (
                <div key={cat} className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <span className="text-xs font-medium text-gray-500">{cat}</span>
                  <span className="text-sm font-bold text-gray-900">{montant.toLocaleString()} FCFA</span>
                </div>
              ))}
              {Object.keys(parCategorie).length === 0 && (
                <p className="text-sm text-gray-400 italic">Aucune dépense sur cette période</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('depenses')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'depenses'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Wallet size={18} />
              <span>Dépenses</span>
            </button>
            <button
              onClick={() => setActiveTab('fournisseurs')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'fournisseurs'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Users size={18} />
              <span>Fournisseurs</span>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'depenses' && (
            <>
              {showForm && (
                <DepenseForm
                  onDesc={closeForm}
                  initialData={editingDepense || undefined}
                />
              )}
              <DepenseList onEdit={handleEditDepense} />
            </>
          )}

          {activeTab === 'fournisseurs' && (
            <FournisseurList />
          )}
        </div>
      </div>
    </div>
  );
};
