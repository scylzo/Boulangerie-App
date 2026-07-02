import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-sand-700 mb-1">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          block w-full rounded-lg border border-sand-300 px-3 py-2 text-sand-900
          focus:border-terracotta-500 focus:ring-terracotta-500 focus:ring-1 sm:text-sm
          transition-colors bg-white
          ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}
          ${className}
        `}
        {...props}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-danger-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-sand-500">{helperText}</p>
      )}
    </div>
  );
};