import React, { useState } from 'react';
import { ConfirmModal } from './ConfirmModal';

interface ConfirmButtonProps {
  children: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  className?: string;
  disabled?: boolean;
  // Props du bouton
  [key: string]: any;
}

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({
  children,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  type = 'info',
  className = '',
  disabled = false,
  ...buttonProps
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    await onConfirm();
    setShowConfirmation(false);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
  };

  return (
    <div className="relative">
      <button
        {...buttonProps}
        className={className}
        onClick={handleClick}
        disabled={disabled}
      >
        {children}
      </button>

      <ConfirmModal
        isOpen={showConfirmation}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={title}
        message={message}
        confirmText={confirmText}
        cancelText={cancelText}
        type={type}
        position="relative"
      />
    </div>
  );
};