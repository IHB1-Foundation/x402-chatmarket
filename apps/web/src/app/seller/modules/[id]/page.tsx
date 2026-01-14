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

interface EvalCase {
  id: string;
  prompt: string;
  rubric: string | null;
  expectedKeywords: string[];
}

interface EvalCaseResult {
  caseId: string;
  prompt: string;
  response: string;
  score: number;
  passed: boolean;
  matchedKeywords: string[];
  missingKeywords: string[];
}

interface EvalRun {
  id: string;
  score: number;
  totalCases: number;
  passedCases: number;
  details: EvalCaseResult[];
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

  // Eval state
  const [evalCases, setEvalCases] = useState<EvalCase[]>([]);
  const [latestEvalRun, setLatestEvalRun] = useState<EvalRun | null>(null);
  const [evalRunning, setEvalRunning] = useState(false);
  const [showAddEvalCase, setShowAddEvalCase] = useState(false);
  const [newCasePrompt, setNewCasePrompt] = useState('');
  const [newCaseKeywords, setNewCaseKeywords] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !id) return;

    const fetchModule = async () => {
      setLoading(true);
      try {
        const [moduleRes, docsRes, evalCasesRes, evalRunRes] = await Promise.all([
          fetch(`${API_URL}/api/seller/modules/${id}`, { headers: getAuthHeaders() }),
          fetch(`${API_URL}/api/seller/modules/${id}/documents`, { headers: getAuthHeaders() }),
          fetch(`${API_URL}/api/seller/modules/${id}/eval/cases`, { headers: getAuthHeaders() }),
          fetch(`${API_URL}/api/seller/modules/${id}/eval`, { headers: getAuthHeaders() }),
        ]);

        if (!moduleRes.ok) {
          throw new Error('Failed to fetch module');
        }

        setModule(await moduleRes.json());
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocuments(docsData.documents);
        }
        if (evalCasesRes.ok) {
          const evalData = await evalCasesRes.json();
          setEvalCases(evalData.cases || []);
        }
        if (evalRunRes.ok) {
          const evalRunData = await evalRunRes.json();
          if (evalRunData.hasRun) {
            setLatestEvalRun(evalRunData);
          }
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

  const handleAddEvalCase = async () => {
    if (!newCasePrompt.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/seller/modules/${id}/eval/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          cases: [
            {
              prompt: newCasePrompt,
              expectedKeywords: newCaseKeywords
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean),
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEvalCases([...evalCases, ...data.cases]);
        setNewCasePrompt('');
        setNewCaseKeywords('');
        setShowAddEvalCase(false);
      }
    } catch (err) {
      alert('Failed to add eval case');
    }
  };

  const handleRunEval = async () => {
    if (evalCases.length === 0) {
      alert('Please add eval cases first');
      return;
    }

    setEvalRunning(true);
    try {
      const res = await fetch(`${API_URL}/api/seller/modules/${id}/eval/run`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setLatestEvalRun(data);
        if (module) {
          setModule({ ...module, evalScore: data.score });
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to run eval');
      }
    } catch (err) {
      alert('Failed to run eval');
    } finally {
      setEvalRunning(false);
    }
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

      {/* Eval Section */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Evaluation</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowAddEvalCase(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#e0e0e0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              + Add Case
            </button>
            <button
              onClick={handleRunEval}
              disabled={evalRunning || evalCases.length === 0}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: evalCases.length > 0 ? '#2e7d32' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: evalCases.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {evalRunning ? 'Running...' : 'Run Eval'}
            </button>
          </div>
        </div>

        {/* Latest Score */}
        {latestEvalRun && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: latestEvalRun.score >= 7 ? '#e8f5e9' : latestEvalRun.score >= 4 ? '#fff3e0' : '#ffebee',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '1.5rem' }}>{latestEvalRun.score}/10</strong>
                <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                  ({latestEvalRun.passedCases}/{latestEvalRun.totalCases} passed)
                </span>
              </div>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>
                {new Date(latestEvalRun.createdAt).toLocaleString()}
              </span>
            </div>

            {/* Show failed cases */}
            {latestEvalRun.details.filter((d) => !d.passed).length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong style={{ fontSize: '0.875rem', color: '#c62828' }}>Failed Cases:</strong>
                {latestEvalRun.details
                  .filter((d) => !d.passed)
                  .slice(0, 2)
                  .map((failedCase, i) => (
                    <div
                      key={i}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div>
                        <strong>Q:</strong> {failedCase.prompt}
                      </div>
                      <div style={{ color: '#666', marginTop: '0.25rem' }}>
                        <strong>A:</strong> {failedCase.response.slice(0, 150)}...
                      </div>
                      <div style={{ color: '#c62828', marginTop: '0.25rem' }}>
                        Missing: {failedCase.missingKeywords.join(', ')}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Eval Cases */}
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Eval Cases ({evalCases.length})</h3>
        {evalCases.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            No eval cases defined. Add cases to evaluate your module's quality.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {evalCases.map((ec) => (
              <div
                key={ec.id}
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <div>{ec.prompt}</div>
                {ec.expectedKeywords.length > 0 && (
                  <div style={{ marginTop: '0.25rem', color: '#666' }}>
                    Keywords: {ec.expectedKeywords.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Case Form */}
        {showAddEvalCase && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
            }}
          >
            <h4 style={{ margin: '0 0 1rem' }}>Add Eval Case</h4>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>Prompt</label>
              <input
                type="text"
                value={newCasePrompt}
                onChange={(e) => setNewCasePrompt(e.target.value)}
                placeholder="What question should the module answer?"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                Expected Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={newCaseKeywords}
                onChange={(e) => setNewCaseKeywords(e.target.value)}
                placeholder="keyword1, keyword2, ..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleAddEvalCase}
                disabled={!newCasePrompt.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: newCasePrompt.trim() ? '#0070f3' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newCasePrompt.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Add
              </button>
              <button
                onClick={() => setShowAddEvalCase(false)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
