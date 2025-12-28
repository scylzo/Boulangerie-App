import React from 'react';
import { Icon } from '@iconify/react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  inline?: boolean;
  position?: 'center' | 'relative';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  type = 'info',
  inline = false,
  position = 'center'
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getTypeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          icon: 'mdi:alert-circle',
          iconColor: 'text-amber-600',
          confirmBg: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
        };
      case 'danger':
        return {
          icon: 'mdi:alert-circle',
          iconColor: 'text-red-600',
          confirmBg: 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'
        };
      case 'success':
        return {
          icon: 'mdi:check-circle',
          iconColor: 'text-green-600',
          confirmBg: 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
        };
      default:
        return {
          icon: 'mdi:help-circle',
          iconColor: 'text-purple-600',
          confirmBg: 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
        };
    }
  };

  const config = getTypeConfig();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" inline={inline} position={position}>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Icon icon={config.icon} className={`text-3xl ${config.iconColor}`} />
          </div>
          <div className="flex-1">
            <div className="text-gray-700">
              {message}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-6">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-5 py-3 text-sm font-bold text-white ${config.confirmBg} border border-transparent rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};