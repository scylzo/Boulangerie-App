import React, { useState } from 'react';
import { Icon } from '@iconify/react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  type = 'text',
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-sand-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          className={`
            block w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sand-900 placeholder:text-sand-500
            focus:border-terracotta-500 focus:ring-terracotta-500 focus:ring-1 sm:text-sm
            transition-colors
            ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}
            ${className}
            ${isPassword ? 'pr-10' : ''}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sand-500 hover:text-sand-700 focus:outline-none"
            tabIndex={-1}
          >
            <Icon
              icon={showPassword ? 'mdi:eye-off' : 'mdi:eye'}
              className="h-5 w-5"
            />
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-danger-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-sand-500">{helperText}</p>
      )}
    </div>
  );
};