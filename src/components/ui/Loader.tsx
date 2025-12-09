import React from 'react';
import { Icon } from '@iconify/react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  message = 'Chargement...',
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  const LoaderContent = () => (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="animate-spin">
        <Icon
          icon="mdi:loading"
          className={`${sizeClasses[size]} text-orange-600`}
        />
      </div>
      {message && (
        <p className={`${textSizes[size]} text-gray-600 font-medium`}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 shadow-lg border">
          <LoaderContent />
        </div>
      </div>
    );
  }

  return <LoaderContent />;
};

// Composants spécialisés pour des cas d'usage courants
export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Chargement de la page...' }) => (
  <div className="min-h-[400px] flex items-center justify-center">
    <Loader size="lg" message={message} />
  </div>
);

export const ButtonLoader: React.FC = () => (
  <Icon icon="mdi:loading" className="animate-spin h-4 w-4" />
);

export const TableLoader: React.FC<{ message?: string }> = ({ message = 'Chargement des données...' }) => (
  <div className="text-center py-12">
    <Loader size="md" message={message} />
  </div>
);

export const CardLoader: React.FC<{ message?: string }> = ({ message = 'Chargement...' }) => (
  <div className="text-center py-8">
    <Loader size="md" message={message} />
  </div>
);