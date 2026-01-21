import type { Metadata } from 'next';
import { WagmiProvider } from '../providers/WagmiProvider';
import { AppProviders } from '../providers/AppProviders';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'SoulForge',
  description: 'AI Persona & Knowledge Module Marketplace - Pay-per-use with x402',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <WagmiProvider>
          <AppProviders>
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </AppProviders>
        </WagmiProvider>
      </body>
    </html>
  );
}
