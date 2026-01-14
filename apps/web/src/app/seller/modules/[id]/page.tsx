'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSellerAuth } from '../../../../hooks/useSellerAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ModuleDetail {
  id: string;
  type: string;
  name: string;
  description: string;
  tags: string[];
  status: string;
  personaPrompt: string;
  pricingMode: string;
  priceAmount: string;
  sessionPolicy: { minutes?: number; messageCredits?: number } | null;
  payTo: string;
  network: string;
  assetContract: string;
  evalScore: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  id: string;
  sourceType: string;
  title: string;
  content: string;
  createdAt: string;
}

export default function ModuleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated, getAuthHeaders } = useSellerAuth();

  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !id) return;

    const fetchModule = async () => {
      setLoading(true);
      try {
        const [moduleRes, docsRes] = await Promise.all([
          fetch(`${API_URL}/api/seller/modules/${id}`, { headers: getAuthHeaders() }),
          fetch(`${API_URL}/api/seller/modules/${id}/documents`, { headers: getAuthHeaders() }),
        ]);

        if (!moduleRes.ok) {
          throw new Error('Failed to fetch module');
        }

        setModule(await moduleRes.json());
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocuments(docsData.documents);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [isAuthenticated, id, getAuthHeaders]);

  const handlePublish = async () => {
    if (!module) return;
    setActionLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/seller/modules/${id}/publish`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to publish');
      }

      const data = await res.json();
      setModule({ ...module, status: data.status });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!module) return;
    setActionLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/seller/modules/${id}/unpublish`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to unpublish');
      }

      const data = await res.json();
      setModule({ ...module, status: data.status });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unpublish');
    } finally {
      setActionLoading(false);
    }
  };

  const formatPrice = (amount: string, mode: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)} / ${mode === 'per_message' ? 'message' : 'session'}`;
  };

  if (!isAuthenticated) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <p>Please sign in first.</p>
        <Link href="/seller" style={{ color: '#0070f3' }}>
          Go to Seller Dashboard
        </Link>
      </main>
    );
  }

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
        <Link href="/seller" style={{ color: '#0070f3' }}>
          &larr; Back to Dashboard
        </Link>
        <h1>Error</h1>
        <p style={{ color: 'red' }}>{error || 'Module not found'}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/seller" style={{ color: '#0070f3', display: 'inline-block', marginBottom: '1rem' }}>
        &larr; Back to Dashboard
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem' }}>{module.name}</h1>
          <span
            style={{
              fontSize: '0.875rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              backgroundColor:
                module.status === 'published' ? '#e8f5e9' : module.status === 'blocked' ? '#ffebee' : '#fff3e0',
              color: module.status === 'published' ? '#2e7d32' : module.status === 'blocked' ? '#c62828' : '#ef6c00',
            }}
          >
            {module.status}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {module.status === 'draft' && (
            <button
              onClick={handlePublish}
              disabled={actionLoading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {actionLoading ? 'Publishing...' : 'Publish'}
            </button>
          )}
          {module.status === 'published' && (
            <>
              <Link
                href={`/marketplace/${module.id}`}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0070f3',
                  color: '#fff',
                  borderRadius: '4px',
                  textDecoration: 'none',
                }}
              >
                View Public
              </Link>
              <button
                onClick={handleUnpublish}
                disabled={actionLoading}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {actionLoading ? 'Unpublishing...' : 'Unpublish'}
              </button>
            </>
          )}
        </div>
      </div>

      <p style={{ color: '#666', marginBottom: '1.5rem' }}>{module.description || 'No description'}</p>

      {/* Tags */}
      {module.tags.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {module.tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: 'inline-block',
                backgroundColor: '#f0f0f0',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                marginRight: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Module Details */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
        <h2>Module Details</h2>
        <table style={{ width: '100%', fontSize: '0.875rem' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 0', color: '#666', width: '150px' }}>Pricing</td>
              <td>{formatPrice(module.priceAmount, module.pricingMode)}</td>
            </tr>
            {module.sessionPolicy && (
              <tr>
                <td style={{ padding: '0.5rem 0', color: '#666' }}>Session Policy</td>
                <td>
                  {module.sessionPolicy.minutes} minutes / {module.sessionPolicy.messageCredits} messages
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '0.5rem 0', color: '#666' }}>Pay To</td>
              <td style={{ fontFamily: 'monospace' }}>{module.payTo}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 0', color: '#666' }}>Network</td>
              <td>{module.network}</td>
            </tr>
            {module.evalScore !== null && (
              <tr>
                <td style={{ padding: '0.5rem 0', color: '#666' }}>Eval Score</td>
                <td>{module.evalScore}/10</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '0.5rem 0', color: '#666' }}>Created</td>
              <td>{new Date(module.createdAt).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Persona Prompt */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
        <h2>Persona Prompt</h2>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: '1rem',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            fontSize: '0.875rem',
            maxHeight: '200px',
            overflow: 'auto',
          }}
        >
          {module.personaPrompt || '(No persona prompt defined)'}
        </pre>
      </div>

      {/* Knowledge Documents */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem' }}>
        <h2>Knowledge Documents ({documents.length})</h2>
        {documents.length === 0 ? (
          <p style={{ color: '#666' }}>No knowledge documents added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {documents.slice(0, 10).map((doc) => (
              <div
                key={doc.id}
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.875rem' }}>{doc.title}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>{doc.sourceType}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
                  {doc.content.length > 100 ? `${doc.content.slice(0, 100)}...` : doc.content}
                </p>
              </div>
            ))}
            {documents.length > 10 && (
              <p style={{ color: '#666', fontSize: '0.875rem' }}>...and {documents.length - 10} more</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
