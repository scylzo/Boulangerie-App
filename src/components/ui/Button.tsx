import React from 'react';
import { ButtonLoader } from './Loader';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-terracotta-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200';

  const variantClasses = {
    primary: 'bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white shadow-soft',
    secondary: 'bg-sand-800 hover:bg-sand-900 text-white shadow-soft',
    danger: 'bg-danger-500 hover:bg-danger-600 text-white shadow-soft',
    outline: 'border border-sand-300 hover:bg-sand-100 text-sand-800',
    ghost: 'text-sand-700 hover:bg-sand-100'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="-ml-1 mr-3">
          <ButtonLoader />
        </span>
      )}
      {children}
    </button>
  );
};
