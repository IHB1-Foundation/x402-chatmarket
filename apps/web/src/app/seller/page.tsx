'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useSellerAuth } from '../../hooks/useSellerAuth';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { CopyButton } from '../../components/ui/CopyButton';
import { useToast } from '../../components/ui/Toast';
import { getTxExplorerUrl } from '../../lib/explorer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Module {
  id: string;
  type: string;
  name: string;
  description: string;
  tags: string[];
  status: string;
  pricingMode: string;
  priceAmount: string;
  evalScore: number | null;
  createdAt: string;
}

interface Payment {
  id: string;
  moduleId: string;
  moduleName: string;
  payerWallet: string;
  payTo: string;
  value: string;
  txHash: string | null;
  network: string;
  event: string;
  createdAt: string;
}

interface Analytics {
  kpis: {
    totalRevenue7d: string;
    totalRevenue30d: string;
    paidChatsCount: number;
    uniqueBuyers: number;
  };
  revenueTimeseries: Array<{ date: string; revenue: string; payments: number }>;
  topModules: Array<{ id: string; name: string; totalRevenue: string; totalPayments: number }>;
}

function RevenueChart({ data }: { data: Array<{ date: string; revenue: string; payments: number }> }) {
  if (data.length === 0) return null;

  // Get max revenue for scaling
  const maxRevenue = Math.max(...data.map((d) => Number(d.revenue)), 1);
  const chartHeight = 80;
  const barWidth = Math.max(4, Math.min(12, 300 / data.length));

  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-1" style={{ height: chartHeight }}>
        {data.slice(-14).map((point, i) => {
          const height = (Number(point.revenue) / maxRevenue) * chartHeight;
          const hasRevenue = Number(point.revenue) > 0;
          return (
            <div
              key={point.date}
              className="group relative flex flex-col items-center"
              style={{ flex: 1, maxWidth: barWidth + 4 }}
            >
              <div
                className={`
                  w-full rounded-t-sm transition-all
                  ${hasRevenue ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]' : 'bg-[var(--color-border)]'}
                `}
                style={{ height: Math.max(2, height), width: barWidth }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-[var(--color-surface-elevated)] shadow-lg rounded px-2 py-1 text-xs whitespace-nowrap border border-[var(--color-border)]">
                  <div className="font-medium">{new Date(point.date).toLocaleDateString()}</div>
                  <div className="text-[var(--color-text-secondary)]">
                    ${(Number(point.revenue) / 1e6).toFixed(2)} ({point.payments} txns)
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-[var(--color-text-tertiary)]">
        <span>{data.length > 0 ? new Date(data[Math.max(0, data.length - 14)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
        <span>{data.length > 0 ? new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
      </div>
    </div>
  );
}

function KPICard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <Card padding="md">
      <p className="text-sm text-[var(--color-text-secondary)] font-medium">{label}</p>
      <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{value}</p>
      {subtext && <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{subtext}</p>}
    </Card>
  );
}

export default function SellerDashboard() {
  const { isConnected, address } = useAccount();
  const { isAuthenticated, isLoading: authLoading, error: authError, login, logout, getAuthHeaders, user } =
    useSellerAuth();
  const { showToast } = useToast();

  const [modules, setModules] = useState<Module[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Stable auth headers getter
  const authHeaders = useCallback(() => getAuthHeaders(), [getAuthHeaders]);

  // Fetch seller's modules
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchModules = async () => {
      setLoadingModules(true);
      try {
        const res = await fetch(`${API_URL}/api/seller/modules`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setModules(data.modules);
        } else {
          showToast('Failed to load modules', 'error');
        }
      } catch (err) {
        console.error('Failed to fetch modules:', err);
        showToast('Network error loading modules', 'error');
      } finally {
        setLoadingModules(false);
      }
    };

    fetchModules();
  }, [isAuthenticated, authHeaders, showToast]);

  // Fetch payments
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchPayments = async () => {
      setLoadingPayments(true);
      try {
        const res = await fetch(`${API_URL}/api/seller/payments?size=10`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments);
        }
      } catch (err) {
        console.error('Failed to fetch payments:', err);
      } finally {
        setLoadingPayments(false);
      }
    };

    fetchPayments();
  }, [isAuthenticated, authHeaders]);

  // Fetch analytics
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const res = await fetch(`${API_URL}/api/seller/analytics?days=30`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [isAuthenticated, authHeaders]);

  const formatPrice = (amount: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)}`;
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Not connected
  if (!isConnected) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-4">Seller Dashboard</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          Connect your MetaMask wallet using the button in the header to access the seller dashboard.
        </p>
        <Link href="/" className="inline-block mt-8 text-[var(--color-primary)]">
          &larr; Back to Home
        </Link>
      </main>
    );
  }

  // Connected but not authenticated
  if (!isAuthenticated) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-4">Seller Dashboard</h1>
        <div className="mb-4">
          <p className="text-[var(--color-success)]">Wallet: {formatAddress(address!)}</p>
        </div>

        <p className="text-[var(--color-text-secondary)] mb-4">Sign in with your wallet to access seller features.</p>

        {authError && <p className="text-[var(--color-error)] mb-4">{authError}</p>}

        <Button onClick={login} disabled={authLoading}>
          {authLoading ? 'Signing in...' : 'Sign In with MetaMask'}
        </Button>

        <Link href="/" className="inline-block mt-8 text-[var(--color-primary)]">
          &larr; Back to Home
        </Link>
      </main>
    );
  }

  // Authenticated - show dashboard
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Seller Dashboard</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Signed in as {formatAddress(address!)} ({user?.role})
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8">
        <Link href="/seller/create">
          <Button>+ Create Module</Button>
        </Link>
        <Link href="/seller/remix">
          <Button variant="secondary" className="!bg-[var(--color-warning)] hover:!bg-orange-600">
            + Create Remix
          </Button>
        </Link>
      </div>

      {/* KPIs Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Revenue Overview</h2>
        {loadingAnalytics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} padding="md">
                <Skeleton height={16} width="60%" />
                <Skeleton height={32} width="80%" className="mt-2" />
              </Card>
            ))}
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Revenue (7d)"
              value={formatPrice(analytics.kpis.totalRevenue7d)}
              subtext="Last 7 days"
            />
            <KPICard
              label="Revenue (30d)"
              value={formatPrice(analytics.kpis.totalRevenue30d)}
              subtext="Last 30 days"
            />
            <KPICard
              label="Paid Chats"
              value={analytics.kpis.paidChatsCount.toString()}
              subtext="Total paid transactions"
            />
            <KPICard
              label="Unique Buyers"
              value={analytics.kpis.uniqueBuyers.toString()}
              subtext="Distinct wallets"
            />
          </div>
        ) : (
          <Card padding="lg" className="text-center">
            <p className="text-[var(--color-text-secondary)]">No analytics data available yet.</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
              Create and publish modules to start earning revenue.
            </p>
          </Card>
        )}

        {/* Revenue Chart */}
        {analytics && analytics.revenueTimeseries.length > 0 && (
          <Card padding="md" className="mt-4">
            <CardHeader title="Revenue Trend (Last 14 Days)" />
            <RevenueChart data={analytics.revenueTimeseries} />
          </Card>
        )}
      </section>

      {/* Recent Payments */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Payments</h2>
        {loadingPayments ? (
          <Card padding="md">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton height={40} width="100%" />
                </div>
              ))}
            </div>
          </Card>
        ) : payments.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-[var(--color-text-secondary)]">No payments yet.</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
              Payments will appear here when buyers use your modules.
            </p>
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left text-sm font-medium text-[var(--color-text-secondary)] p-4">Module</th>
                    <th className="text-left text-sm font-medium text-[var(--color-text-secondary)] p-4">Amount</th>
                    <th className="text-left text-sm font-medium text-[var(--color-text-secondary)] p-4">Payer</th>
                    <th className="text-left text-sm font-medium text-[var(--color-text-secondary)] p-4">Tx Hash</th>
                    <th className="text-left text-sm font-medium text-[var(--color-text-secondary)] p-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-background-secondary)]">
                      <td className="p-4">
                        <Link
                          href={`/seller/modules/${payment.moduleId}`}
                          className="text-[var(--color-primary)] hover:underline font-medium"
                        >
                          {payment.moduleName}
                        </Link>
                      </td>
                      <td className="p-4">
                        <Badge variant="success">{formatPrice(payment.value)}</Badge>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-sm text-[var(--color-text-secondary)]">
                          {formatAddress(payment.payerWallet)}
                        </span>
                        <CopyButton text={payment.payerWallet} label="payer address" className="ml-2" />
                      </td>
                      <td className="p-4">
                        {payment.txHash ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="font-mono text-sm text-[var(--color-text-secondary)]">
                              {formatAddress(payment.txHash)}
                            </span>
                            <CopyButton text={payment.txHash} label="tx hash" />
                            {getTxExplorerUrl({ network: payment.network, txHash: payment.txHash }) && (
                              <a
                                href={getTxExplorerUrl({ network: payment.network, txHash: payment.txHash }) as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[var(--color-primary)] hover:underline"
                              >
                                View
                              </a>
                            )}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-[var(--color-text-secondary)]">
                        {formatDate(payment.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* Top Modules by Revenue */}
      {analytics && analytics.topModules.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Top Modules by Revenue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.topModules.map((module, idx) => (
              <Card key={module.id} padding="md" hoverable>
                <Link href={`/seller/modules/${module.id}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-[var(--color-text-tertiary)]">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{module.name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="success" size="sm">{formatPrice(module.totalRevenue)}</Badge>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {module.totalPayments} txns
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Modules Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Modules</h2>
        {loadingModules ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} padding="md">
                <div className="flex justify-between">
                  <div className="flex-1">
                    <Skeleton height={24} width="40%" />
                    <Skeleton height={16} width="30%" className="mt-2" />
                  </div>
                  <Skeleton height={32} width={80} />
                </div>
              </Card>
            ))}
          </div>
        ) : modules.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-[var(--color-text-secondary)] mb-2">You haven&apos;t created any modules yet.</p>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Create a base module or remix an existing one to get started.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {modules.map((module) => (
              <Card key={module.id} padding="md" hoverable>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-lg">{module.name}</span>
                      <Badge
                        variant={
                          module.status === 'published'
                            ? 'success'
                            : module.status === 'blocked'
                            ? 'error'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {module.status}
                      </Badge>
                      {module.type === 'remix' && (
                        <Badge variant="primary" size="sm">Remix</Badge>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {module.pricingMode === 'per_message' ? 'Per message' : 'Per session'}: {formatPrice(module.priceAmount)}
                      {module.evalScore !== null && (
                        <span className="ml-3">• Eval: {module.evalScore}/10</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/seller/modules/${module.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                    {module.status === 'published' && (
                      <Link href={`/marketplace/${module.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/marketplace">
            <Button variant="outline">Browse Marketplace</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost">Home</Button>
          </Link>
          <Link href="/x402-poc">
            <Button variant="ghost">x402 POC</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
