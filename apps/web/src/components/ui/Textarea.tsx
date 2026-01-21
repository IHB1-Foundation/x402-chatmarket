'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      fullWidth = false,
      className = '',
      id,
      disabled,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          rows={rows}
          className={`
            w-full
            px-3 py-2
            bg-[var(--color-surface)]
            border rounded-[var(--radius-md)]
            text-[var(--color-text-primary)]
            placeholder:text-[var(--color-text-tertiary)]
            transition-all duration-[var(--transition-fast)]
            resize-y
            ${error
              ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-2 focus:ring-[var(--color-error-light)]'
              : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--color-background-secondary)]' : ''}
            ${className}
          `}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
