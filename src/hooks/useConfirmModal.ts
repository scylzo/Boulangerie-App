import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

export const useConfirmModal = () => {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: ''
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...options,
        isOpen: true,
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (state.resolve) {
      state.resolve(true);
    }
    setState(prev => ({ ...prev, isOpen: false, resolve: undefined }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    if (state.resolve) {
      state.resolve(false);
    }
    setState(prev => ({ ...prev, isOpen: false, resolve: undefined }));
  }, [state.resolve]);

  return {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    confirmText: state.confirmText,
    cancelText: state.cancelText,
    type: state.type,
    confirm,
    handleConfirm,
    handleCancel
  };
};