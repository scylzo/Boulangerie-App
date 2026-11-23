import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStockStore } from '../../store/stockStore';
import { StockDashboard } from '../../components/stock/StockDashboard';
import { MatiereList } from '../../components/stock/MatiereList';
import { MouvementModal } from '../../components/stock/MouvementModal';
import { MouvementsList } from '../../components/stock/MouvementsList';
import { ModalReceptionStock } from '../../components/stock/ModalReceptionStock';
import { BilanMensuelIngredientsModal } from '../../components/stock/BilanMensuelIngredientsModal';
import type { MatierePremiere } from '../../types';
import { Package, History, PlusCircle, CalendarCheck, ClipboardList } from 'lucide-react';

export const GestionStock: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stock' | 'mouvements'>('stock');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceptionModalOpen, setIsReceptionModalOpen] = useState(false);
  const [isBilanModalOpen, setIsBilanModalOpen] = useState(false);
  const [selectedMatiere, setSelectedMatiere] = useState<MatierePremiere | undefined>(undefined);
  const [receptionMatiere, setReceptionMatiere] = useState<MatierePremiere | undefined>(undefined);
  const { chargerDonnees, isLoading, matieres } = useStockStore();

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  if (isLoading && matieres.length === 0) {
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

  const handleOpenReception = (matiere?: MatierePremiere) => {
    setReceptionMatiere(matiere);
    setIsReceptionModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-sand-100 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-terracotta-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg sm:text-2xl font-semibold text-sand-900 truncate">Gestion des Stocks</h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">Réserve de farine, glace et matières premières</p>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleOpenReception()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors text-xs sm:text-sm font-semibold flex-1 sm:flex-none"
              title="Enregistrer une livraison ou un achat de sacs de farine, glace, levure..."
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Réception Stock</span>
            </button>

            <button
              onClick={() => setIsBilanModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-sand-50 text-sand-800 border border-sand-300 rounded-xl shadow-sm transition-colors text-xs sm:text-sm font-medium flex-1 sm:flex-none"
              title="Faire l'inventaire et le bilan des consommations du mois (glace, levure, améliorants...)"
            >
              <CalendarCheck className="w-4 h-4 text-terracotta-600" />
              <span>Bilan Mensuel</span>
            </button>

            <Link
              to="/stocks/declaration"
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sand-900 text-white rounded-xl hover:bg-sand-800 transition-colors shadow-sm text-xs sm:text-sm font-medium flex-1 sm:flex-none"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Saisie Journalière</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <StockDashboard />

        <div className="bg-white rounded-2xl shadow-card border border-sand-200 overflow-hidden">
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
                <span>Inventaire & Réserve</span>
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
              <MatiereList
                onAddMouvement={handleOpenMouvement}
                onReception={handleOpenReception}
              />
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

      <ModalReceptionStock
        isOpen={isReceptionModalOpen}
        onClose={() => {
          setIsReceptionModalOpen(false);
          setReceptionMatiere(undefined);
        }}
        matiereInitiale={receptionMatiere}
      />

      <BilanMensuelIngredientsModal
        isOpen={isBilanModalOpen}
        onClose={() => setIsBilanModalOpen(false)}
      />
    </div>
  );
};
