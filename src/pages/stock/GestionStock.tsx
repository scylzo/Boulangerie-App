import React, { useState, useEffect } from 'react';
import { useStockStore } from '../../store/stockStore';
import { StockDashboard } from '../../components/stock/StockDashboard';
import { MatiereList } from '../../components/stock/MatiereList';
import { MouvementModal } from '../../components/stock/MouvementModal';
import { MouvementsList } from '../../components/stock/MouvementsList';
import { ModalReceptionStock } from '../../components/stock/ModalReceptionStock';
import { StockInventaire } from '../../components/stock/StockInventaire';
import { StockRapportPeriode } from '../../components/stock/StockRapportPeriode';
import { StockBilan } from '../../components/stock/StockBilan';
import type { MatierePremiere } from '../../types';
import {
  Package,
  History,
  PlusCircle,
  ClipboardCheck,
  CalendarRange,
  Scale
} from 'lucide-react';

type TabType = 'reserve' | 'mouvements' | 'rapport' | 'inventaire' | 'bilan';

export const GestionStock: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('reserve');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceptionModalOpen, setIsReceptionModalOpen] = useState(false);
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
      {/* Header unifié et épuré */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
              <Package className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg sm:text-2xl font-semibold text-sand-900 truncate">
                Gestion des Stocks & Matières
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                Réserve de farine, glace et ingrédients • Traçabilité et bilans
              </p>
            </div>
          </div>

          {/* Action principale : Enregistrer une réception de marchandise */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleOpenReception()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all text-xs sm:text-sm font-semibold w-full sm:w-auto cursor-pointer"
              title="Enregistrer l'arrivée de sacs de farine, glace, levure ou ingrédients"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Réception de Stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Vue d'ensemble KPI (niveaux farine, glace, alertes seuil, valeur stock) */}
        <StockDashboard />

        {/* Bloc Onglets Unifiés : Les 5 piliers métiers */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 overflow-hidden">
          <div className="border-b border-sand-200 bg-sand-50/50">
            <nav className="flex space-x-1 sm:space-x-2 px-2 sm:px-4 overflow-x-auto no-scrollbar" aria-label="Tabs">
              {/* 1. Réserve & Matières */}
              <button
                onClick={() => setActiveTab('reserve')}
                className={`flex items-center space-x-1.5 sm:space-x-2 py-3 px-3 border-b-2 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'reserve'
                    ? 'border-emerald-600 text-emerald-800 bg-white/70 rounded-t-lg'
                    : 'border-transparent text-sand-600 hover:text-sand-900 hover:border-sand-300'
                }`}
              >
                <Package size={16} className={activeTab === 'reserve' ? 'text-emerald-700' : ''} />
                <span>Réserve & Matières</span>
              </button>

              {/* 2. Historique des flux */}
              <button
                onClick={() => setActiveTab('mouvements')}
                className={`flex items-center space-x-1.5 sm:space-x-2 py-3 px-3 border-b-2 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'mouvements'
                    ? 'border-emerald-600 text-emerald-800 bg-white/70 rounded-t-lg'
                    : 'border-transparent text-sand-600 hover:text-sand-900 hover:border-sand-300'
                }`}
              >
                <History size={16} className={activeTab === 'mouvements' ? 'text-emerald-700' : ''} />
                <span>Historique Mouvements</span>
              </button>

              {/* 3. Rapport par Période */}
              <button
                onClick={() => setActiveTab('rapport')}
                className={`flex items-center space-x-1.5 sm:space-x-2 py-3 px-3 border-b-2 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'rapport'
                    ? 'border-emerald-600 text-emerald-800 bg-white/70 rounded-t-lg'
                    : 'border-transparent text-sand-600 hover:text-sand-900 hover:border-sand-300'
                }`}
              >
                <CalendarRange size={16} className={activeTab === 'rapport' ? 'text-emerald-700' : ''} />
                <span>Rapport par Période</span>
              </button>

              {/* 4. Inventaire Physique */}
              <button
                onClick={() => setActiveTab('inventaire')}
                className={`flex items-center space-x-1.5 sm:space-x-2 py-3 px-3 border-b-2 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'inventaire'
                    ? 'border-emerald-600 text-emerald-800 bg-white/70 rounded-t-lg'
                    : 'border-transparent text-sand-600 hover:text-sand-900 hover:border-sand-300'
                }`}
              >
                <ClipboardCheck size={16} className={activeTab === 'inventaire' ? 'text-emerald-700' : ''} />
                <span>Inventaire Physique</span>
              </button>

              {/* 5. Bilan Journalier & Mensuel */}
              <button
                onClick={() => setActiveTab('bilan')}
                className={`flex items-center space-x-1.5 sm:space-x-2 py-3 px-3 border-b-2 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'bilan'
                    ? 'border-emerald-600 text-emerald-800 bg-white/70 rounded-t-lg'
                    : 'border-transparent text-sand-600 hover:text-sand-900 hover:border-sand-300'
                }`}
              >
                <Scale size={16} className={activeTab === 'bilan' ? 'text-emerald-700' : ''} />
                <span>Bilan Journalier & Mensuel</span>
              </button>
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {/* 1. Réserve & Matières */}
            {activeTab === 'reserve' && (
              <MatiereList
                onAddMouvement={handleOpenMouvement}
                onReception={handleOpenReception}
              />
            )}

            {/* 2. Historique des flux */}
            {activeTab === 'mouvements' && (
              <MouvementsList />
            )}

            {/* 3. Rapport par Période */}
            {activeTab === 'rapport' && (
              <StockRapportPeriode />
            )}

            {/* 4. Inventaire Physique */}
            {activeTab === 'inventaire' && (
              <StockInventaire />
            )}

            {/* 5. Bilan Journalier & Mensuel */}
            {activeTab === 'bilan' && (
              <StockBilan />
            )}
          </div>
        </div>
      </div>

      {/* Modale d'Ajustement / Mouvement individuel */}
      <MouvementModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMatiere(undefined);
        }}
        selectedMatiere={selectedMatiere}
      />

      {/* Modale d'Entrée / Réception de Stock (moderne et soignée) */}
      <ModalReceptionStock
        isOpen={isReceptionModalOpen}
        onClose={() => {
          setIsReceptionModalOpen(false);
          setReceptionMatiere(undefined);
        }}
        matiereInitiale={receptionMatiere}
      />
    </div>
  );
};
