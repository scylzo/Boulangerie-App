import React from 'react';

interface RadialGaugeProps {
  /** Valeur en pourcentage (0–100) */
  value: number;
  size?: number;
  stroke?: number;
  /** Couleur de l'arc de progression (text-*) */
  className?: string;
  /** Couleur du rail de fond (text-*) */
  trackClassName?: string;
  /** Contenu central (défaut : le pourcentage) */
  label?: React.ReactNode;
}

/**
 * Jauge circulaire d'objectif (ex. avancement de production).
 * SVG pur, couleurs via tokens.
 */
export const RadialGauge: React.FC<RadialGaugeProps> = ({
  value,
  size = 72,
  stroke = 8,
  className = 'text-sand-900',
  trackClassName = 'text-sand-200',
  label,
}) => {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className={trackClassName} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          className={className}
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <span className="absolute text-sm font-semibold text-sand-900 tabular-nums">
        {label ?? `${Math.round(v)}%`}
      </span>
    </div>
  );
};
