'use client';

import { type ReactNode } from 'react';
import { ThemeProvider } from '../components/ui/ThemeToggle';
import { ToastProvider } from '../components/ui/Toast';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
