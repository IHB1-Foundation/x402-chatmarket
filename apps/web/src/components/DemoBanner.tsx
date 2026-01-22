'use client';

import Link from 'next/link';
import { useState } from 'react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (!DEMO_MODE || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 px-4">
      <div className="container mx-auto flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">DEMO</span>
          <span className="hidden sm:inline">
            Running in demo mode with mock payments and seeded data.
          </span>
          <span className="sm:hidden">Demo mode active</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/marketplace"
              className="hover:underline opacity-90 hover:opacity-100"
            >
              Marketplace
            </Link>
            <span className="opacity-50">|</span>
            <Link
              href="/seller"
              className="hover:underline opacity-90 hover:opacity-100"
            >
              Seller
            </Link>
            <span className="opacity-50">|</span>
            <Link
              href="/x402-poc"
              className="hover:underline opacity-90 hover:opacity-100"
            >
              x402 POC
            </Link>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Dismiss demo banner"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
