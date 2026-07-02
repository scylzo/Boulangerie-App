import React from 'react';
import { Icon } from '@iconify/react';

interface BadgeProps {
  children: React.ReactNode;
  /** Ton sémantique du badge */
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'brand' | 'gold';
  size?: 'sm' | 'md';
  /** Icône Iconify optionnelle affichée avant le texte */
  icon?: string;
  className?: string;
}

/**
 * Badge / pastille de statut. Idéal pour états ("Actif", "Payé", "En rupture"),
 * tags et compteurs. S'appuie sur les tokens sémantiques du design system.
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  tone = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  const toneClasses = {
    neutral: 'bg-sand-100 text-sand-700 ring-sand-200',
    success: 'bg-success-50 text-success-700 ring-success-100',
    danger: 'bg-danger-50 text-danger-600 ring-danger-100',
    warning: 'bg-warning-50 text-warning-600 ring-warning-100',
    info: 'bg-info-50 text-info-600 ring-info-100',
    brand: 'bg-terracotta-50 text-terracotta-700 ring-terracotta-100',
    gold: 'bg-gold-50 text-gold-600 ring-gold-200',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ring-1 ring-inset ${toneClasses[tone]} ${sizeClasses[size]} ${className}`}
    >
      {icon && <Icon icon={icon} className={size === 'sm' ? 'text-xs' : 'text-sm'} />}
      {children}
    </span>
  );
};
