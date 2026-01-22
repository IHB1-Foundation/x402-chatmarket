'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Module {
  id: string;
  name: string;
  description: string;
  type: string;
  tags: string[];
  priceAmount: string;
  pricingMode: string;
  evalScore: number | null;
  featured: boolean;
}

export default function Home() {
  const [featuredModules, setFeaturedModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch(`${API_URL}/api/modules?featured=true&size=6`);
        if (res.ok) {
          const data = await res.json();
          setFeaturedModules(data.modules || []);
        }
      } catch (error) {
        console.error('Failed to fetch featured modules:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const formatPrice = (amount: string, mode: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)}/${mode === 'per_message' ? 'msg' : 'session'}`;
  };

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Featured Modules */}
      <section className="py-16 bg-[var(--color-background-secondary)]">
        <div className="container-app">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
              Featured Modules
            </h2>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm">
                View All →
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} variant="default" padding="md">
                  <Skeleton variant="text" width="60%" height={24} className="mb-2" />
                  <Skeleton variant="text" width="100%" height={16} className="mb-1" />
                  <Skeleton variant="text" width="80%" height={16} className="mb-4" />
                  <div className="flex gap-2">
                    <Skeleton variant="rounded" width={60} height={24} />
                    <Skeleton variant="rounded" width={60} height={24} />
                  </div>
                </Card>
              ))}
            </div>
          ) : featuredModules.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredModules.map((module) => (
                <Link key={module.id} href={`/marketplace/${module.id}`}>
                  <Card
                    hoverable
                    padding="none"
                    className="h-full overflow-hidden ring-2 ring-[var(--color-primary)]/30"
                  >
                    <div className="bg-[var(--color-primary)] text-white text-xs font-medium px-3 py-1 text-center">
                      Featured
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-[var(--color-text-primary)] line-clamp-1">
                          {module.name}
                        </h3>
                        {module.evalScore !== null && (
                          <Badge variant="success" size="sm">{module.evalScore}/10</Badge>
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2 min-h-[2.5rem]">
                        {module.description || 'AI-powered module'}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {module.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" size="sm">{tag}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                        <span className="font-semibold text-[var(--color-primary)]">
                          {formatPrice(module.priceAmount, module.pricingMode)}
                        </span>
                        <Badge
                          variant={module.type === 'remix' ? 'warning' : 'primary'}
                          size="sm"
                          title={
                            module.type === 'remix'
                              ? 'Remix: derivative module that calls and pays an upstream module at runtime.'
                              : 'Base: standalone module with its own persona + knowledge.'
                          }
                        >
                          {module.type === 'remix' ? 'Remix' : 'Base'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card variant="bordered" padding="lg" className="text-center">
              <p className="text-[var(--color-text-secondary)]">
                No featured modules yet. Check back soon or browse the marketplace.
              </p>
              <Link href="/marketplace">
                <Button variant="secondary" className="mt-4">
                  Browse All Modules
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </section>

      {/* For Sellers */}
      <section className="py-16 bg-[var(--color-background)]">
        <div className="container-app">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-4">
              For Sellers
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Create, upload, and monetize AI modules with zero code
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card variant="bordered" padding="lg" className="text-center">
              <div className="text-4xl mb-4">🎭</div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                Create Persona
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Define a unique AI character with custom system prompts and example interactions
              </p>
            </Card>
            <Card variant="bordered" padding="lg" className="text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                Upload Knowledge
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Add Q&A pairs, documents, or external data to power RAG-enhanced responses
              </p>
            </Card>
            <Card variant="bordered" padding="lg" className="text-center">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                Monetize via x402
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Set your price and earn from every paid chat - automatic settlement to your wallet
              </p>
            </Card>
          </div>
          <div className="text-center mt-8">
            <Link href="/seller">
              <Button size="lg">
                Start Creating
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-8 bg-[var(--color-background-secondary)] border-y border-[var(--color-border)]">
        <div className="container-app">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="text-sm text-[var(--color-text-tertiary)]">Built with:</span>
            {['x402', 'pgvector RAG', 'SIWE Auth', 'EIP-712', 'USDC'].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1 text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-full)] text-[var(--color-text-secondary)]"
              >
                {tech}
              </span>
            ))}
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
