'use client';

import Link from 'next/link';
import { LogoMark } from '../brand/LogoMark';

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-background-secondary)]">
      <div className="container-app py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <LogoMark size={20} className="shrink-0" />
            <span className="text-sm font-medium">SoulForge</span>
            <span className="text-sm">- Pay-per-use AI modules with x402</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-[var(--color-text-tertiary)]">
            <Link
              href="/marketplace"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/seller"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Create Module
            </Link>
            <Link
              href="/x402-poc"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              x402 Demo
            </Link>
          </div>

          {/* Tech badges */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)]">
              x402
            </span>
            <span className="px-2 py-1 text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)]">
              pgvector
            </span>
            <span className="px-2 py-1 text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)]">
              SIWE
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
