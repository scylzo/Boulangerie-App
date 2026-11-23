import React, { useMemo } from 'react';
import { useStockStore } from '../../store/stockStore';
import { Icon } from '@iconify/react';
import { formaterQuantite } from '../../utils/calculations';
import { formatCurrency } from '../../utils/currency';

export const StockDashboard: React.FC = () => {
  const { matieres } = useStockStore();

  const { farine, glace, nbFaibles, valeurTotale } = useMemo(() => {
    let farineMat: typeof matieres[0] | undefined;
    let glaceMat: typeof matieres[0] | undefined;
    let faibles = 0;
    let valeur = 0;

    matieres.forEach(m => {
      const nom = m.nom.toLowerCase();
      if (!farineMat && nom.includes('farine')) farineMat = m;
      if (!glaceMat && nom.includes('glace')) glaceMat = m;

      if (m.stockMinimum > 0 && m.stockActuel <= m.stockMinimum) {
        faibles++;
      }

      if (m.stockActuel > 0 && m.prixUnitaireMoyen > 0) {
        valeur += m.stockActuel * m.prixUnitaireMoyen;
      }
    });

    return {
      farine: farineMat,
      glace: glaceMat,
      nbFaibles: faibles,
      valeurTotale: valeur
    };
  }, [matieres]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Farine */}
      <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-card flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <Icon icon="mdi:wheat" className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-sand-500 uppercase tracking-wide">
            Farine en Réserve
          </p>
          <p className="text-xl font-black text-sand-900 truncate mt-0.5">
            {farine ? formaterQuantite(farine.stockActuel, farine.unite) : '—'}
          </p>
          <p className="text-[11px] text-sand-400 mt-0.5 truncate">
            {farine?.stockMinimum ? `Seuil alerte : ${formaterQuantite(farine.stockMinimum, farine.unite)}` : 'Matière pétrin'}
          </p>
        </div>
      </div>

      {/* 2. Glace */}
      <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-card flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
          <Icon icon="mdi:snowflake" className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-sand-500 uppercase tracking-wide">
            Glace Disponible
          </p>
          <p className="text-xl font-black text-sand-900 truncate mt-0.5">
            {glace ? formaterQuantite(glace.stockActuel, glace.unite) : '—'}
          </p>
          <p className="text-[11px] text-cyan-700 mt-0.5 font-medium truncate">
            {glace ? `PMP : ${formatCurrency(Math.round(glace.prixUnitaireMoyen))}/${glace.unite}` : 'Non créée'}
          </p>
        </div>
      </div>

      {/* 3. Alertes / Seuil faible */}
      <div className={`bg-white p-5 rounded-2xl border shadow-card flex items-center gap-4 ${
        nbFaibles > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-sand-200'
      }`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          nbFaibles > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
        }`}>
          <Icon icon={nbFaibles > 0 ? "mdi:alert" : "mdi:check-circle"} className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-sand-500 uppercase tracking-wide">
            Matières sous Seuil
          </p>
          <p className={`text-xl font-black mt-0.5 ${nbFaibles > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {nbFaibles} matière{nbFaibles > 1 ? 's' : ''}
          </p>
          <p className="text-[11px] text-sand-400 mt-0.5 truncate">
            {nbFaibles > 0 ? 'Réapprovisionnement requis' : 'Tous les stocks sont OK'}
          </p>
        </div>
      </div>

      {/* 4. Valeur totale du stock */}
      <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-card flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-sand-100 text-sand-700 flex items-center justify-center shrink-0">
          <Icon icon="mdi:cash-multiple" className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-sand-500 uppercase tracking-wide">
            Valeur Marchandise
          </p>
          <p className="text-xl font-black text-sand-900 truncate mt-0.5">
            {formatCurrency(Math.round(valeurTotale))}
          </p>
          <p className="text-[11px] text-sand-400 mt-0.5 truncate">
            Total {matieres.length} matière{matieres.length > 1 ? 's' : ''} en réserve
          </p>
        </div>
      </div>
    </div>
  );
};

