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
          iconColor: 'text-warning-600',
          confirmBg: 'bg-warning-500 hover:bg-warning-600'
        };
      case 'danger':
        return {
          icon: 'mdi:alert-circle',
          iconColor: 'text-danger-600',
          confirmBg: 'bg-danger-500 hover:bg-danger-600'
        };
      case 'success':
        return {
          icon: 'mdi:check-circle',
          iconColor: 'text-success-600',
          confirmBg: 'bg-success-500 hover:bg-success-600'
        };
      default:
        return {
          icon: 'mdi:help-circle',
          iconColor: 'text-terracotta-500',
          confirmBg: 'bg-terracotta-500 hover:bg-terracotta-600'
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
            <div className="text-sand-700">
              {message}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-6">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 text-sm font-semibold text-sand-700 bg-white hover:bg-sand-50 border border-sand-300 rounded-lg hover:shadow-soft transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sand-400 focus:ring-offset-2"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-5 py-3 text-sm font-semibold text-white ${config.confirmBg} border border-transparent rounded-lg shadow-soft hover:shadow-card transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};