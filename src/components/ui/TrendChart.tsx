import React from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  /** Couleur de la courbe/aire (text-*) */
  className?: string;
  /** Formatage de la valeur au survol / du max */
  valueFormat?: (v: number) => string;
}

/**
 * Courbe de tendance (aire + ligne) avec libellés d'axe X, responsive (w-full).
 * SVG pur, couleur via tokens. Ex. chiffre d'affaires sur 7 jours.
 */
export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  height = 160,
  className = 'text-sand-900',
  valueFormat = (v) => v.toLocaleString('fr-FR'),
}) => {
  if (!data || data.length === 0) return null;
  const W = Math.max(data.length * 44, 240);
  const H = height;
  const padY = 16;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;

  const pts = data.map((d, i) => {
    const x = data.length === 1 ? W / 2 : (i / (data.length - 1)) * W;
    const y = H - padY - ((d.value - min) / range) * (H - padY * 2);
    return { x, y };
  });
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  const maxIdx = data.reduce((mi, d, i, a) => (d.value > a[mi].value ? i : mi), 0);

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`w-full h-full ${className}`}>
          {/* Gridlines */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={0} x2={W} y1={padY + g * (H - padY * 2)} y2={padY + g * (H - padY * 2)}
              className="text-sand-200" stroke="currentColor" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}
          <polygon points={area} className="fill-current opacity-[0.07]" stroke="none" />
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Point haut mis en valeur */}
        <div
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${(pts[maxIdx].x / W) * 100}%`, top: `${(pts[maxIdx].y / H) * 100}%` }}
        >
          <span className="inline-block px-1.5 py-0.5 rounded-md bg-sand-900 text-white text-[10px] font-medium tabular-nums whitespace-nowrap mb-1">
            {valueFormat(data[maxIdx].value)}
          </span>
        </div>
      </div>
      {/* Axe X */}
      <div className="flex justify-between mt-2 px-0.5">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-sand-400">{d.label}</span>
        ))}
      </div>
    </div>
  );
};
