import React, { useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { AlertCircle, Package, Calendar } from 'lucide-react';
import { Icon } from '@iconify/react';

export const StockDashboard: React.FC = () => {
  const { matieres } = useStockStore();

  // États pour le filtre de date (conservé pour cohérence UI, même si moins utilisé sans les stats financières)
  const [dateDebut, setDateDebut] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  return (
    <>
      {/* Filtre de Date */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-sand-200 shadow-sm mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-info-50 rounded-lg text-info-600 shrink-0">
              <Icon icon="mdi:chart-box" className="text-lg sm:text-xl" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-sand-800">Tableau de Bord Stock</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 bg-sand-50 p-2 rounded-lg border border-sand-200 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-sand-500 shrink-0 sm:w-[18px] sm:h-[18px]" />
              <span className="text-xs sm:text-sm font-medium text-sand-700 whitespace-nowrap">Période :</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="bg-white border border-sand-300 text-sand-900 text-xs sm:text-sm rounded-md focus:ring-info-500 focus:border-info-500 block p-1.5 flex-1 sm:flex-none min-w-0"
              />
              <span className="text-sand-400 text-xs sm:text-sm shrink-0">à</span>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="bg-white border border-sand-300 text-sand-900 text-xs sm:text-sm rounded-md focus:ring-info-500 focus:border-info-500 block p-1.5 flex-1 sm:flex-none min-w-0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl border border-sand-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-sand-500">Matières Référencées</p>
              <h3 className="text-2xl font-bold text-sand-900 mt-1">
                {matieres.length}
              </h3>
              <p className="text-xs text-sand-400 mt-1">Au total</p>
            </div>
            <div className="p-3 bg-info-50 rounded-lg text-info-600">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-sand-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-sand-500">Stock Faible</p>
              <h3 className="text-2xl font-bold text-sand-900 mt-1">
                {matieres.filter(m => m.stockMinimum > 0 && m.stockActuel <= m.stockMinimum).length}
              </h3>
              <p className="text-xs text-danger-500 mt-1">À réapprovisionner</p>
            </div>
            <div className="p-3 bg-danger-50 rounded-lg text-danger-600">
              <AlertCircle size={24} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
