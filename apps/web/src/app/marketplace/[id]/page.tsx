'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <p>Loading module...</p>
      </main>
    );
  }

  if (error || !module) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/marketplace" style={{ color: '#0070f3' }}>&larr; Back to Marketplace</Link>
        <h1>Error</h1>
        <p style={{ color: 'red' }}>{error || 'Module not found'}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/marketplace" style={{ color: '#0070f3', display: 'inline-block', marginBottom: '1.5rem' }}>
        &larr; Back to Marketplace
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem' }}>{module.name}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.875rem',
                backgroundColor: module.type === 'remix' ? '#fff3e0' : '#e3f2fd',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              {module.type}
            </span>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>
              by {formatAddress(module.ownerAddress)}
            </span>
          </div>
        </div>
        {module.evalScore !== null && (
          <div
            style={{
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{module.evalScore}/10</div>
            <div style={{ fontSize: '0.75rem' }}>Eval Score</div>
          </div>
        )}
      </div>

      <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#333', marginBottom: '1.5rem' }}>
        {module.description || 'No description provided.'}
      </p>

      {/* Tags */}
      {module.tags.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {module.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  backgroundColor: '#f0f0f0',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '16px',
                  fontSize: '0.875rem',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pricing Card */}
      <div
        style={{
          border: '2px solid #0070f3',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          backgroundColor: '#f8faff',
        }}
      >
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0070f3', marginBottom: '0.5rem' }}>
          {formatPrice(module.priceAmount, module.pricingMode)}
        </div>
        {module.sessionPolicy && (
          <div style={{ fontSize: '0.875rem', color: '#666' }}>
            Session includes:{' '}
            {module.sessionPolicy.minutes && `${module.sessionPolicy.minutes} minutes`}
            {module.sessionPolicy.minutes && module.sessionPolicy.messageCredits && ' or '}
            {module.sessionPolicy.messageCredits && `${module.sessionPolicy.messageCredits} messages`}
          </div>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          <Link
            href={`/chat/${module.id}?mode=try`}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#fff',
              border: '1px solid #0070f3',
              color: '#0070f3',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            Try Once (Free)
          </Link>
          <Link
            href={`/chat/${module.id}`}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0070f3',
              color: '#fff',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            Paid Chat
          </Link>
        </div>
      </div>

      {/* Example Prompts */}
      {module.examplePrompts.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Example Questions</h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {module.examplePrompts.map((prompt, idx) => (
              <li key={idx} style={{ marginBottom: '0.5rem', color: '#555' }}>
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Module Info */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Module Information</h3>
        <table style={{ width: '100%', fontSize: '0.875rem' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 0', color: '#666' }}>Knowledge Documents</td>
              <td style={{ padding: '0.5rem 0' }}>{module.documentCount}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 0', color: '#666' }}>Network</td>
              <td style={{ padding: '0.5rem 0' }}>{module.network}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 0', color: '#666' }}>Payment Address</td>
              <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>{module.payTo}</td>
            </tr>
            {module.upstreamModuleId && (
              <tr>
                <td style={{ padding: '0.5rem 0', color: '#666' }}>Upstream Module</td>
                <td style={{ padding: '0.5rem 0' }}>
                  <Link href={`/marketplace/${module.upstreamModuleId}`} style={{ color: '#0070f3' }}>
                    View Original
                  </Link>
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '0.5rem 0', color: '#666' }}>Created</td>
              <td style={{ padding: '0.5rem 0' }}>{new Date(module.createdAt).toLocaleDateString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
