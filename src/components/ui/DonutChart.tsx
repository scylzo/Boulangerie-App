import React from 'react';

export interface DonutSlice {
  label: string;
  value: number;
  /** Classe de couleur (text-*) — ex. text-sand-900, text-gold-500 */
  className: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  stroke?: number;
  centerValue?: React.ReactNode;
  centerLabel?: React.ReactNode;
}

/**
 * Donut de répartition (ex. structure des coûts). SVG pur, couleurs via tokens.
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 148,
  stroke = 22,
  centerValue,
  centerLabel,
}) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className="text-sand-100" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * c;
          const offset = -acc * c;
          acc += frac;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              stroke="currentColor"
              className={d.className}
              strokeDasharray={`${dash.toFixed(2)} ${(c - dash).toFixed(2)}`}
              strokeDashoffset={offset.toFixed(2)}
            />
          );
        })}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-lg font-semibold text-sand-900 tabular-nums leading-none">{centerValue}</span>}
          {centerLabel && <span className="text-[11px] text-sand-500 mt-0.5">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
};
