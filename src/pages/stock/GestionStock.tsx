import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStockStore } from '../../store/stockStore';
import { StockDashboard } from '../../components/stock/StockDashboard';
import { MatiereList } from '../../components/stock/MatiereList';
import { MouvementModal } from '../../components/stock/MouvementModal';
import { MouvementsList } from '../../components/stock/MouvementsList';
import type { MatierePremiere } from '../../types';
import { Package, History } from 'lucide-react';

export const GestionStock: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stock' | 'mouvements'>('stock');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMatiere, setSelectedMatiere] = useState<MatierePremiere | undefined>(undefined);
  const { chargerDonnees, isLoading } = useStockStore();

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-warning-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleOpenMouvement = (matiere: MatierePremiere) => {
    setSelectedMatiere(matiere);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-sand-100 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-sand-900 truncate">Gestion des Stocks</h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">Suivi des matières premières</p>
            </div>
          </div>
          <Link
            to="/stocks/declaration"
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-colors shadow-sm text-xs sm:text-sm font-medium w-full sm:w-auto shrink-0"
          >
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Saisie Journalière</span>
          </Link>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <StockDashboard />

        <div className="bg-white rounded-xl shadow-sm border border-sand-200 overflow-hidden">
          <div className="border-b border-sand-100 bg-sand-50/50">
            <nav className="flex space-x-2 sm:space-x-4 px-4 sm:px-6 overflow-x-auto" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('stock')}
                className={`flex items-center space-x-1.5 sm:space-x-2 py-3 sm:py-4 px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${activeTab === 'stock'
                  ? 'border-sand-900 text-sand-900'
                  : 'border-transparent text-sand-500 hover:text-sand-700 hover:border-sand-300'
                  }`}
              >
                <Package size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span>Inventaire</span>
              </button>
              <button
                onClick={() => setActiveTab('mouvements')}
                className={`flex items-center space-x-1.5 sm:space-x-2 py-3 sm:py-4 px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${activeTab === 'mouvements'
                  ? 'border-sand-900 text-sand-900'
                  : 'border-transparent text-sand-500 hover:text-sand-700 hover:border-sand-300'
                  }`}
              >
                <History size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span>Historique Mouvements</span>
              </button>
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'stock' && (
              <MatiereList onAddMouvement={handleOpenMouvement} />
            )}
            {activeTab === 'mouvements' && (
              <MouvementsList />
            )}
          </div>
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
