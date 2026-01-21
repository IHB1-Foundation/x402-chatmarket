'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Skeleton, SkeletonText } from '../../../components/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs';
import { CopyButton } from '../../../components/ui/CopyButton';

interface ModuleDetail {
  id: string;
  type: string;
  name: string;
  description: string;
  tags: string[];
  pricingMode: string;
  priceAmount: string;
  sessionPolicy: { minutes?: number; messageCredits?: number } | null;
  payTo: string;
  network: string;
  assetContract: string;
  ownerAddress: string;
  upstreamModuleId: string | null;
  evalScore: number | null;
  lastEvalAt: string | null;
  documentCount: number;
  examplePrompts: string[];
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ModuleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModule = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_URL}/api/modules/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Module not found');
          throw new Error('Failed to fetch module');
        }
        const data = await res.json();
        setModule(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchModule();
  }, [id]);

  const formatPrice = (amount: string, mode: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)} / ${mode === 'per_message' ? 'message' : 'session'}`;
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (loading) {
    return (
      <div className="container-narrow py-8">
        <Skeleton variant="text" width={120} height={20} className="mb-6" />
        <div className="flex justify-between items-start mb-6">
          <div>
            <Skeleton variant="text" width={300} height={36} className="mb-2" />
            <Skeleton variant="text" width={200} height={20} />
          </div>
          <Skeleton variant="rounded" width={80} height={80} />
        </div>
        <SkeletonText lines={3} className="mb-6" />
        <Skeleton variant="rounded" width="100%" height={200} />
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="container-narrow py-8">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-[var(--color-primary)] hover:underline mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Marketplace
        </Link>
        <Card variant="bordered" padding="lg" className="text-center py-12">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Module Not Found
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-4">
            {error || 'This module does not exist or has been removed.'}
          </p>
          <Link href="/marketplace">
            <Button variant="secondary">Browse Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-narrow py-8 animate-fade-in">
      {/* Back Link */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 text-[var(--color-primary)] hover:underline mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Marketplace
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            {module.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={module.type === 'remix' ? 'warning' : 'primary'}>
              {module.type}
            </Badge>
            <span className="text-sm text-[var(--color-text-secondary)]">
              by {formatAddress(module.ownerAddress)}
            </span>
          </div>
        </div>
        {module.evalScore !== null && (
          <div className="flex-shrink-0 text-center px-6 py-4 bg-[var(--color-success-light)] rounded-[var(--radius-lg)]">
            <div className="text-2xl font-bold text-[var(--color-success)]">
              {module.evalScore}/10
            </div>
            <div className="text-xs text-[var(--color-success)]">Eval Score</div>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mb-6">
        {module.description || 'No description provided.'}
      </p>

      {/* Tags */}
      {module.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {module.tags.map((tag) => (
            <Badge key={tag} variant="outline" size="md">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultTab="overview" className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="developer">Developer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Example Prompts */}
          {module.examplePrompts.length > 0 && (
            <Card variant="bordered" padding="md" className="mb-4">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
                Example Questions
              </h3>
              <ul className="space-y-2">
                {module.examplePrompts.map((prompt, idx) => (
                  <li
                    key={idx}
                    className="text-[var(--color-text-secondary)] pl-4 border-l-2 border-[var(--color-border)]"
                  >
                    {prompt}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Module Info */}
          <Card variant="bordered" padding="md">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
              Module Information
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Knowledge Documents</dt>
                <dd className="text-[var(--color-text-primary)] font-medium">{module.documentCount}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Network</dt>
                <dd className="text-[var(--color-text-primary)] font-medium">{module.network}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Created</dt>
                <dd className="text-[var(--color-text-primary)] font-medium">
                  {new Date(module.createdAt).toLocaleDateString()}
                </dd>
              </div>
              {module.upstreamModuleId && (
                <div>
                  <dt className="text-[var(--color-text-tertiary)]">Upstream Module</dt>
                  <dd>
                    <Link
                      href={`/marketplace/${module.upstreamModuleId}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      View Original
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card
            variant="bordered"
            padding="lg"
            className="border-2 border-[var(--color-primary)] bg-[var(--color-primary-light)]"
          >
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-[var(--color-primary)] mb-2">
                {formatPrice(module.priceAmount, module.pricingMode)}
              </div>
              {module.sessionPolicy && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Session includes:{' '}
                  {module.sessionPolicy.minutes && `${module.sessionPolicy.minutes} minutes`}
                  {module.sessionPolicy.minutes && module.sessionPolicy.messageCredits && ' or '}
                  {module.sessionPolicy.messageCredits && `${module.sessionPolicy.messageCredits} messages`}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/chat/${module.id}?mode=try`}>
                <Button variant="outline" fullWidth>
                  Try Once (Free)
                </Button>
              </Link>
              <Link href={`/chat/${module.id}`}>
                <Button fullWidth>Paid Chat</Button>
              </Link>
            </div>
            <p className="text-xs text-center text-[var(--color-text-tertiary)] mt-4">
              Payment address: {formatAddress(module.payTo)}
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="developer">
          <Card variant="bordered" padding="md">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
              API Integration
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-[var(--color-text-tertiary)]">
                    Try Once (Free Preview)
                  </label>
                  <CopyButton
                    text={`curl -X POST ${API_URL}/api/modules/${module.id}/chat -H "Content-Type: application/json" -d '{"message": "Hello", "mode": "try"}'`}
                    label="curl command"
                    showText
                  />
                </div>
                <pre className="p-3 bg-[var(--color-background-secondary)] rounded-[var(--radius-md)] text-xs overflow-x-auto font-mono">
{`curl -X POST ${API_URL}/api/modules/${module.id}/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello", "mode": "try"}'`}
                </pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-[var(--color-text-tertiary)]">
                    Paid Request (with X-PAYMENT header)
                  </label>
                  <CopyButton
                    text={`curl -X POST ${API_URL}/api/modules/${module.id}/chat -H "Content-Type: application/json" -H "X-PAYMENT: <base64-encoded-payment>" -d '{"message": "Hello"}'`}
                    label="curl command"
                    showText
                  />
                </div>
                <pre className="p-3 bg-[var(--color-background-secondary)] rounded-[var(--radius-md)] text-xs overflow-x-auto font-mono">
{`curl -X POST ${API_URL}/api/modules/${module.id}/chat \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-encoded-payment>" \\
  -d '{"message": "Hello"}'`}
                </pre>
              </div>
              <div className="pt-4 border-t border-[var(--color-border)]">
                <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Payment Requirements
                </h4>
                <dl className="text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <dt className="text-[var(--color-text-tertiary)]">Network:</dt>
                    <dd className="font-mono">{module.network}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="text-[var(--color-text-tertiary)]">Asset:</dt>
                    <dd className="font-mono flex items-center gap-1">
                      {module.assetContract.slice(0, 10)}...{module.assetContract.slice(-8)}
                      <CopyButton text={module.assetContract} label="asset contract" />
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="text-[var(--color-text-tertiary)]">Pay To:</dt>
                    <dd className="font-mono flex items-center gap-1">
                      {module.payTo.slice(0, 10)}...{module.payTo.slice(-8)}
                      <CopyButton text={module.payTo} label="pay to address" />
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="text-[var(--color-text-tertiary)]">Amount:</dt>
                    <dd className="font-mono">{module.priceAmount} (smallest units)</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CTA Buttons (always visible) */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link href={`/chat/${module.id}?mode=try`} className="flex-1">
          <Button variant="outline" fullWidth size="lg">
            Try Once (Free)
          </Button>
        </Link>
        <Link href={`/chat/${module.id}`} className="flex-1">
          <Button fullWidth size="lg">
            Start Paid Chat
          </Button>
        </Link>
      </div>
    </div>
  );
}
