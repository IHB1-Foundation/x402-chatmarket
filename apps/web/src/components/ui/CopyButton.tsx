'use client';

import { useState } from 'react';
import { useToast } from './Toast';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  showText?: boolean;
}

export function CopyButton({ text, label = 'Copy', className = '', showText = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Copied to clipboard', 'success', 2000);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast('Failed to copy', 'error', 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-1.5
        px-2 py-1
        text-xs font-medium
        bg-[var(--color-background-secondary)]
        hover:bg-[var(--color-border)]
        text-[var(--color-text-secondary)]
        hover:text-[var(--color-text-primary)]
        rounded-[var(--radius-sm)]
        transition-all duration-[var(--transition-fast)]
        ${className}
      `}
      title={`Copy ${label}`}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
      {showText && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}

// Inline variant for use inside text
export function CopyableText({
  text,
  displayText,
  className = '',
}: {
  text: string;
  displayText?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm ${className}`}>
      <span className="truncate max-w-[200px]">{displayText || text}</span>
      <CopyButton text={text} label="address" />
    </span>
  );
}
