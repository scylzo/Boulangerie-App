import React, { useEffect } from 'react';
import { Icon } from '@iconify/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  inline?: boolean; // Mode inline sans overlay
  position?: 'center' | 'relative'; // Position du modal
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  inline = false,
  position = 'center'
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Plus de blocage du scroll - l'utilisateur peut toujours naviguer
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      // S'assurer que le scroll est toujours libre
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  // Mode relative - popover/dropdown positionné près du parent
  if (position === 'relative') {
    return (
      <div className="absolute top-full right-0 mt-3 w-96 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 z-50 animate-in slide-in-from-top-2 fade-in">
        {/* Petite flèche pointant vers le bouton */}
        <div className="absolute -top-2 right-6 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"></div>

        {/* Header moderne avec gradient subtil */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-gray-50 to-white rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"></div>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 hover:scale-105 transition-all duration-200 group"
            title="Fermer"
          >
            <Icon icon="mdi:close" className="text-gray-500 group-hover:text-gray-700 text-xl transition-colors" />
          </button>
        </div>

        {/* Content avec padding cohérent */}
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    );
  }

  // Mode inline - s'intègre dans le flow de la page
  if (inline) {
    return (
      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-lg mb-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-gray-100 transition-colors"
          >
            <Icon icon="mdi:close" className="text-gray-500 text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    );
  }

  // Mode modal centré sans bloquer la page
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Background transparent */}
      <div className="fixed inset-0 bg-transparent" />

      {/* Modal centré */}
      <div className={`relative w-full ${sizeClasses[size]} mx-4 bg-gray-100 rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto border border-gray-200 animate-in zoom-in-95 fade-in duration-300`}>
        {/* Header moderne */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-gray-50 to-white rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"></div>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 hover:scale-105 transition-all duration-200 group"
          >
            <Icon icon="mdi:close" className="text-gray-500 group-hover:text-gray-700 text-xl transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
};