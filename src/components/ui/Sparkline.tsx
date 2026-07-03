import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Classe de couleur du tracé (text-*) */
  className?: string;
  /** Remplissage dégradé sous la courbe */
  fill?: boolean;
}

/**
 * Micro-courbe de tendance (inline, sans axes). Idéale dans une StatCard.
 * Sans dépendance — SVG pur, couleur via `currentColor`.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 64,
  height = 24,
  className = 'text-sand-900',
  fill = false,
}) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((d - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none">
      {fill && <polygon points={`0,${height} ${line} ${width},${height}`} className="fill-current opacity-10" stroke="none" />}
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
