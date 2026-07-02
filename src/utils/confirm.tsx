import React from 'react';
import toast from 'react-hot-toast';
import { Icon } from '@iconify/react';

interface ConfirmToastProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmToast: React.FC<ConfirmToastProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmer',
  cancelText = 'Annuler'
}) => {
  return (
    <div className="bg-white border border-sand-200 rounded-lg shadow-lg p-4 max-w-md">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon icon="mdi:help-circle" className="text-warning-500 text-2xl" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-sand-900 mb-2">{title}</h3>
          <div className="text-sm text-sand-600 whitespace-pre-line mb-4">
            {message}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onConfirm();
                toast.dismiss();
              }}
              className="flex-1 bg-warning-500 hover:bg-warning-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {confirmText}
            </button>
            <button
              onClick={() => {
                onCancel?.();
                toast.dismiss();
              }}
              className="flex-1 bg-sand-200 hover:bg-sand-300 text-sand-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Fonction utilitaire pour afficher une confirmation
export const confirmAction = (options: Omit<ConfirmToastProps, 'onCancel'> & { onCancel?: () => void }): Promise<boolean> => {
  return new Promise((resolve) => {
    const { onCancel, ...restOptions } = options;

    toast.custom((_t) => (
      <ConfirmToast
        {...restOptions}
        onConfirm={() => resolve(true)}
        onCancel={() => {
          onCancel?.();
          resolve(false);
        }}
      />
    ), {
      duration: Infinity,
      position: 'top-center',
    });
  });
};

// Fonction simplifiée pour les confirmations rapides
export const confirm = (message: string, title = 'Confirmation'): Promise<boolean> => {
  return confirmAction({
    title,
    message,
    onConfirm: () => {}
  });
};