import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SoulForge',
  description: 'AI Persona & Knowledge Module Marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
