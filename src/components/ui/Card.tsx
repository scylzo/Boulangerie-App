import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle
}) => {
  return (
    <div className={`bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${className}`}>
      {(title || subtitle) && (
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 bg-gray-50/50">
          {title && (
            <div className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {title}
            </div>
          )}
          {subtitle && (
            <div className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600 line-clamp-2">
              {subtitle}
            </div>
          )}
        </div>
      )}
      <div className="px-4 py-3 sm:px-6 sm:py-4 overflow-hidden">
        {children}
      </div>
    </div>
  );
};