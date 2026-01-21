'use client';

import Link from 'next/link';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function Home() {
  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-[var(--color-primary-light)] to-[var(--color-background)]">
        <div className="container-app text-center">
          <Badge variant="primary" className="mb-4">
            Powered by x402 Protocol
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-text-primary)] mb-4">
            Pay-per-use AI Modules
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-8">
            Discover and monetize AI personas and knowledge packs.
            HTTP 402 enables seamless pay-as-you-go without subscriptions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/marketplace">
              <Button size="lg">
                Browse Marketplace
              </Button>
            </Link>
            <Link href="/seller">
              <Button variant="outline" size="lg">
                Become a Seller
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-[var(--color-background)]">
        <div className="container-app">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--color-text-primary)] mb-12">
            How x402 Payment Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '1',
                title: 'Request Access',
                desc: 'Call a paid API endpoint without payment header',
                icon: '🔒',
              },
              {
                step: '2',
                title: 'Receive 402',
                desc: 'Server returns HTTP 402 with payment requirements',
                icon: '💳',
              },
              {
                step: '3',
                title: 'Sign & Pay',
                desc: 'Wallet signs EIP-712 payment authorization',
                icon: '✍️',
              },
              {
                step: '4',
                title: 'Get Response',
                desc: 'Payment settles, AI response delivered',
                icon: '✅',
              },
            ].map((item) => (
              <Card key={item.step} variant="bordered" padding="lg" className="text-center">
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="w-8 h-8 mx-auto mb-3 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {item.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-[var(--color-background-secondary)]">
        <div className="container-app">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                For Buyers
              </h3>
              <ul className="space-y-2 text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  Browse curated AI personas
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  Pay only for what you use
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  No subscriptions or commitments
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  Transparent payment tracking
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                For Sellers
              </h3>
              <ul className="space-y-2 text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  Create modules without code
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  Upload Q&A or documents
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  Set your own pricing
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-success)]">✓</span>
                  Earn from remixes via agent payments
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                Remix Economics
              </h3>
              <ul className="space-y-2 text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-primary)]">→</span>
                  Derivatives pay originals at runtime
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-primary)]">→</span>
                  No data copying required
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-primary)]">→</span>
                  Agent-to-agent payments
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-primary)]">→</span>
                  Two payment events per call
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[var(--color-background)]">
        <div className="container-app text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-4">
            Ready to explore?
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-8 max-w-lg mx-auto">
            Try the x402 payment flow in our proof-of-concept demo, or browse real AI modules in the marketplace.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/x402-poc">
              <Button variant="secondary">
                Try x402 Demo
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button>
                View Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
