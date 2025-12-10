import React, { useState, useEffect } from 'react';
import { useStockStore } from '../../store/stockStore';
import { StockDashboard } from '../../components/stock/StockDashboard';
import { MatiereList } from '../../components/stock/MatiereList';
import { MouvementModal } from '../../components/stock/MouvementModal';
import { MouvementsList } from '../../components/stock/MouvementsList';
import { FournisseurList } from '../../components/stock/FournisseurList';
import type { MatierePremiere } from '../../types';
import { Package, History, Users } from 'lucide-react';

export const GestionStock: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stock' | 'mouvements' | 'fournisseurs'>('stock');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMatiere, setSelectedMatiere] = useState<MatierePremiere | undefined>(undefined);
  const { chargerDonnees, isLoading } = useStockStore();

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleOpenMouvement = (matiere: MatierePremiere) => {
    setSelectedMatiere(matiere);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Stocks</h1>
          <p className="text-gray-500">Suivi des matières premières et dépenses (FCFA)</p>
        </div>
      </div>

      <StockDashboard />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('stock')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'stock'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package size={18} />
              <span>Inventaire</span>
            </button>
            <button
              onClick={() => setActiveTab('mouvements')} // Placeholder for future implementation
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'mouvements'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <History size={18} />
              <span>Historique Mouvements</span>
            </button>
            <button
              onClick={() => setActiveTab('fournisseurs')} // Placeholder for future implementation
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'fournisseurs'
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
          {activeTab === 'stock' && (
            <MatiereList onAddMouvement={handleOpenMouvement} />
          )}
          {activeTab === 'mouvements' && (
            <MouvementsList />
          )}
          {activeTab === 'fournisseurs' && (
            <FournisseurList />
          )}
        </div>
      </div>

      <MouvementModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMatiere(undefined);
        }}
        selectedMatiere={selectedMatiere}
      />
    </div>
  );
};
