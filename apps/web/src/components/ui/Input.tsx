'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftAddon,
      rightAddon,
      fullWidth = false,
      className = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 flex items-center text-[var(--color-text-tertiary)]">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`
              w-full
              px-3 py-2
              bg-[var(--color-surface)]
              border rounded-[var(--radius-md)]
              text-[var(--color-text-primary)]
              placeholder:text-[var(--color-text-tertiary)]
              transition-all duration-[var(--transition-fast)]
              ${error
                ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-2 focus:ring-[var(--color-error-light)]'
                : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--color-background-secondary)]' : ''}
              ${leftAddon ? 'pl-10' : ''}
              ${rightAddon ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 flex items-center text-[var(--color-text-tertiary)]">
              {rightAddon}
            </div>
          )}
        </div>
        {(error || hint) && (
          <p
            className={`mt-1.5 text-sm ${
              error ? 'text-[var(--color-error)]' : 'text-[var(--color-text-tertiary)]'
            }`}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
