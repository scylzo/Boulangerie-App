import React from 'react';
import { Icon } from '@iconify/react';

interface EmptyStateProps {
  /** Icône Iconify illustrant l'état vide */
  icon?: string;
  title: string;
  description?: string;
  /** Action principale optionnelle (ex. un <Button>) */
  action?: React.ReactNode;
  className?: string;
}

/**
 * État vide standardisé : pastille d'icône douce, titre display, description
 * et action optionnelle. À utiliser quand une liste/tableau n'a aucun élément.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'mdi:tray',
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`text-center py-12 sm:py-16 px-4 ${className}`}>
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
        <Icon icon={icon} className="text-3xl sm:text-4xl text-sand-500" />
      </div>
      <h3 className="font-display text-lg sm:text-xl font-semibold text-sand-900 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm sm:text-base text-sand-600 max-w-md mx-auto mb-6">
          {description}
        </p>
      )}
      {action}
    </div>
  );
};
