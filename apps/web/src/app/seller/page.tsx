'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useSellerAuth } from '../../hooks/useSellerAuth';

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
  payerWallet: string;
  value: string;
  event: string;
  createdAt: string;
}

export default function SellerDashboard() {
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { isConnected, address } = useAccount();
  const { isAuthenticated, isLoading: authLoading, error: authError, login, logout, getAuthHeaders, user } =
    useSellerAuth();

  const [modules, setModules] = useState<Module[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);

  // Fetch seller's modules
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchModules = async () => {
      setLoadingModules(true);
      try {
        const res = await fetch(`${API_URL}/api/seller/modules`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setModules(data.modules);
        }
      } catch (err) {
        console.error('Failed to fetch modules:', err);
      } finally {
        setLoadingModules(false);
      }
    };

    fetchModules();
  }, [isAuthenticated, getAuthHeaders]);

  const formatPrice = (amount: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)}`;
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Not connected
  if (!isConnected) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Seller Dashboard</h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>Connect your wallet to access the seller dashboard.</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
        <Link href="/" style={{ display: 'block', marginTop: '2rem', color: '#0070f3' }}>
          &larr; Back to Home
        </Link>
      </main>
    );
  }

  // Connected but not authenticated
  if (!isAuthenticated) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Seller Dashboard</h1>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ color: 'green' }}>Wallet: {formatAddress(address!)}</p>
          <button onClick={() => disconnect()} style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}>
            Disconnect
          </button>
        </div>

        <p style={{ color: '#666', marginBottom: '1rem' }}>Sign in with your wallet to access seller features.</p>

        {authError && <p style={{ color: 'red', marginBottom: '1rem' }}>{authError}</p>}

        <button
          onClick={login}
          disabled={authLoading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: authLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {authLoading ? 'Signing in...' : 'Sign In with Ethereum'}
        </button>

        <Link href="/" style={{ display: 'block', marginTop: '2rem', color: '#0070f3' }}>
          &larr; Back to Home
        </Link>
      </main>
    );
  }

  // Authenticated - show dashboard
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Seller Dashboard</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#666' }}>
            Signed in as {formatAddress(address!)} ({user?.role})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            href="/seller/create"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0070f3',
              color: '#fff',
              borderRadius: '4px',
              textDecoration: 'none',
            }}
          >
            Create Module
          </Link>
          <button
            onClick={logout}
            style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Modules Section */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>Your Modules</h2>
        {loadingModules ? (
          <p>Loading modules...</p>
        ) : modules.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
            }}
          >
            <p style={{ color: '#666', marginBottom: '1rem' }}>You haven&apos;t created any modules yet.</p>
            <Link
              href="/seller/create"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0070f3',
                color: '#fff',
                borderRadius: '4px',
                textDecoration: 'none',
              }}
            >
              Create Your First Module
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {modules.map((module) => (
              <div
                key={module.id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <strong>{module.name}</strong>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor:
                          module.status === 'published'
                            ? '#e8f5e9'
                            : module.status === 'blocked'
                            ? '#ffebee'
                            : '#fff3e0',
                        color:
                          module.status === 'published'
                            ? '#2e7d32'
                            : module.status === 'blocked'
                            ? '#c62828'
                            : '#ef6c00',
                      }}
                    >
                      {module.status}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
                    {module.pricingMode === 'per_message' ? 'Per message' : 'Per session'}: {formatPrice(module.priceAmount)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link
                    href={`/seller/modules/${module.id}`}
                    style={{ color: '#0070f3', padding: '0.5rem 1rem' }}
                  >
                    Edit
                  </Link>
                  {module.status === 'published' && (
                    <Link
                      href={`/marketplace/${module.id}`}
                      style={{ color: '#666', padding: '0.5rem 1rem' }}
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section>
        <h2>Quick Links</h2>
        <ul style={{ lineHeight: '2' }}>
          <li>
            <Link href="/marketplace" style={{ color: '#0070f3' }}>
              Browse Marketplace
            </Link>
          </li>
          <li>
            <Link href="/" style={{ color: '#0070f3' }}>
              Home
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
