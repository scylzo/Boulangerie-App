import React from 'react';
import { Icon } from '@iconify/react';

interface StatCardProps {
  /** Libellé de l'indicateur, ex. "Chiffre d'affaires" */
  label: string;
  /** Valeur principale, ex. "1 250 000 FCFA" */
  value: React.ReactNode;
  /** Icône Iconify affichée dans la pastille */
  icon?: string;
  /** Variation en pourcentage (ex. 12 ou -4). Colore et oriente la flèche. */
  trend?: number;
  /** Texte contextuel sous la variation, ex. "vs mois dernier" */
  trendLabel?: string;
  /** Accent de la pastille d'icône */
  tone?: 'brand' | 'gold' | 'success' | 'info' | 'neutral';
  className?: string;
}

/**
 * Carte KPI pour tableaux de bord. Valeur mise en avant en police display,
 * pastille d'icône et indicateur de tendance coloré.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendLabel,
  tone = 'brand',
  className = '',
}) => {
  const toneClasses = {
    brand: 'bg-terracotta-50 text-terracotta-600',
    gold: 'bg-gold-50 text-gold-600',
    success: 'bg-success-50 text-success-600',
    info: 'bg-info-50 text-info-600',
    neutral: 'bg-sand-100 text-sand-600',
  };

  const hasTrend = typeof trend === 'number';
  const isUp = hasTrend && trend! >= 0;

  return (
    <div
      className={`bg-white border border-sand-200 rounded-2xl shadow-card hover:shadow-elevated transition-all duration-200 p-5 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-sand-500 truncate">{label}</p>
        {icon && (
          <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
            <Icon icon={icon} className="text-xl" />
          </div>
        )}
      </div>
      <p className="font-display text-2xl sm:text-3xl font-semibold text-sand-900 truncate tabular-nums">
        {value}
      </p>
      {hasTrend && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center gap-0.5 font-semibold ${
              isUp ? 'text-success-600' : 'text-danger-600'
            }`}
          >
            <Icon icon={isUp ? 'mdi:arrow-up' : 'mdi:arrow-down'} className="text-sm" />
            {isUp ? '+' : ''}
            {trend}%
          </span>
          {trendLabel && <span className="text-sand-500 truncate">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
};
