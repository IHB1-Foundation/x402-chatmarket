'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useSellerAuth } from '../../../hooks/useSellerAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type WizardStep = 'upstream' | 'persona' | 'pricing' | 'review' | 'success';

interface UpstreamModule {
  id: string;
  name: string;
  description: string;
  priceAmount: string;
  pricingMode: string;
  payTo: string;
}

interface AgentWalletInfo {
  address: string;
  fundingInstructions: string;
}

export default function CreateRemixPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { isAuthenticated, getAuthHeaders } = useSellerAuth();

  const [step, setStep] = useState<WizardStep>('upstream');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available upstream modules
  const [upstreamModules, setUpstreamModules] = useState<UpstreamModule[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);

  // Form state
  const [selectedUpstreamId, setSelectedUpstreamId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [deltaPersona, setDeltaPersona] = useState('');
  const [pricingMode, setPricingMode] = useState<'per_message' | 'per_session'>('per_message');
  const [priceAmount, setPriceAmount] = useState('0.02');
  const [sessionMinutes, setSessionMinutes] = useState('30');
  const [sessionCredits, setSessionCredits] = useState('10');
  const [payTo, setPayTo] = useState(address || '');

  // Result state
  const [createdModuleId, setCreatedModuleId] = useState<string | null>(null);
  const [agentWallet, setAgentWallet] = useState<AgentWalletInfo | null>(null);

  // Fetch published modules for upstream selection
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const res = await fetch(`${API_URL}/api/modules?size=100`);
        if (res.ok) {
          const data = await res.json();
          setUpstreamModules(data.modules || []);
        }
      } catch (err) {
        console.error('Failed to fetch modules:', err);
      } finally {
        setLoadingModules(false);
      }
    };
    fetchModules();
  }, []);

  // Update payTo when address changes
  useEffect(() => {
    if (address && !payTo) setPayTo(address);
  }, [address, payTo]);

  const selectedUpstream = upstreamModules.find((m) => m.id === selectedUpstreamId);

  const formatPrice = (amount: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)}`;
  };

  if (!isAuthenticated) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Create Remix Module</h1>
        <p>Please sign in first.</p>
        <Link href="/seller" style={{ color: '#0070f3' }}>
          Go to Seller Dashboard
        </Link>
      </main>
    );
  }

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'upstream', label: 'Upstream' },
    { id: 'persona', label: 'Persona' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'review', label: 'Review' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const priceInSmallestUnits = Math.round(parseFloat(priceAmount) * 1e6).toString();

      const res = await fetch(`${API_URL}/api/seller/remix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name,
          description,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          upstreamModuleId: selectedUpstreamId,
          deltaPersonaPrompt: deltaPersona,
          pricingMode,
          priceAmount: priceInSmallestUnits,
          sessionPolicy:
            pricingMode === 'per_session'
              ? {
                  minutes: parseInt(sessionMinutes, 10),
                  messageCredits: parseInt(sessionCredits, 10),
                }
              : undefined,
          payTo,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create remix module');
      }

      const data = await res.json();
      setCreatedModuleId(data.id);
      setAgentWallet(data.agentWallet);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create remix module');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '700px', margin: '0 auto' }}>
      <Link href="/seller" style={{ color: '#0070f3', display: 'inline-block', marginBottom: '1rem' }}>
        &larr; Back to Dashboard
      </Link>

      <h1>Create Remix Module</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        A remix module builds on an existing module, paying the upstream at runtime.
      </p>
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#fff8e1',
          border: '1px solid #ffe0b2',
          borderRadius: '8px',
          margin: '-1rem 0 2rem',
          color: '#333',
          fontSize: '0.9rem',
          lineHeight: 1.4,
        }}
      >
        <strong>Remix</strong> is a derivative module: buyers pay your remix, then the server uses a remix agent wallet to pay/call the upstream module and generate the final response.
        If you want a standalone module,{' '}
        <Link href="/seller/create" style={{ color: '#0070f3' }}>
          create a Base module
        </Link>
        .
      </div>

      {step !== 'success' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {steps.map((s, i) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                padding: '0.5rem',
                textAlign: 'center',
                backgroundColor: i <= currentStepIndex ? '#ff9800' : '#e0e0e0',
                color: i <= currentStepIndex ? '#fff' : '#666',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: i < currentStepIndex ? 'pointer' : 'default',
              }}
              onClick={() => i < currentStepIndex && setStep(s.id)}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Step: Select Upstream */}
      {step === 'upstream' && (
        <div>
          <h2>Select Upstream Module</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Choose a published module to build upon. Your remix will pay this module at runtime.
          </p>

          {loadingModules ? (
            <p>Loading modules...</p>
          ) : upstreamModules.length === 0 ? (
            <p style={{ color: '#ef6c00' }}>No published modules available. Create a base module first.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {upstreamModules.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedUpstreamId(m.id)}
                  style={{
                    padding: '1rem',
                    border: selectedUpstreamId === m.id ? '2px solid #ff9800' : '1px solid #ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedUpstreamId === m.id ? '#fff3e0' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{m.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    {m.description || 'No description'}
                  </div>
                  <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Price: {formatPrice(m.priceAmount)} / {m.pricingMode === 'per_message' ? 'message' : 'session'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedUpstream && (
            <div style={{ padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px', marginBottom: '1rem' }}>
              <strong>Selected:</strong> {selectedUpstream.name}
              <br />
              <span style={{ fontSize: '0.875rem', color: '#666' }}>
                Your remix must price higher than {formatPrice(selectedUpstream.priceAmount)} to cover upstream costs
              </span>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Remix Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Remix Module"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="This remix adds..."
              rows={3}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="remix, enhanced"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <button
            onClick={() => setStep('persona')}
            disabled={!selectedUpstreamId || !name.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: selectedUpstreamId && name.trim() ? '#ff9800' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedUpstreamId && name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Next: Persona
          </button>
        </div>
      )}

      {/* Step: Persona */}
      {step === 'persona' && (
        <div>
          <h2>Delta Persona</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Define how your remix modifies or enhances the upstream module's persona.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Delta System Prompt
            </label>
            <textarea
              value={deltaPersona}
              onChange={(e) => setDeltaPersona(e.target.value)}
              placeholder="You are a remixed version that adds a humorous twist to the responses. Always include a joke related to the topic..."
              rows={8}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
              This will be combined with the upstream response to create your unique output.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setStep('upstream')}
              style={{ padding: '0.75rem 1.5rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={() => setStep('pricing')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ff9800',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Next: Pricing
            </button>
          </div>
        </div>
      )}

      {/* Step: Pricing */}
      {step === 'pricing' && (
        <div>
          <h2>Pricing</h2>
          {selectedUpstream && (
            <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px', marginBottom: '1rem' }}>
              <strong>Upstream Cost:</strong> {formatPrice(selectedUpstream.priceAmount)} / message
              <br />
              <span style={{ fontSize: '0.875rem', color: '#666' }}>
                Set your price higher to cover this cost and earn profit
              </span>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Pricing Mode</label>
            <select
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as 'per_message' | 'per_session')}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="per_message">Per Message</option>
              <option value="per_session">Per Session</option>
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Price (USD) {pricingMode === 'per_message' ? 'per message' : 'per session'}
            </label>
            <input
              type="number"
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
              min="0.001"
              step="0.001"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          {pricingMode === 'per_session' && (
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
              <h3 style={{ margin: '0 0 1rem' }}>Session Policy</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Minutes</label>
                  <input
                    type="number"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(e.target.value)}
                    min="1"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Message Credits</label>
                  <input
                    type="number"
                    value={sessionCredits}
                    onChange={(e) => setSessionCredits(e.target.value)}
                    min="1"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>
            </div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Payment Address</label>
            <input
              type="text"
              value={payTo}
              onChange={(e) => setPayTo(e.target.value)}
              placeholder="0x..."
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setStep('persona')}
              style={{ padding: '0.75rem 1.5rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!payTo.match(/^0x[a-fA-F0-9]{40}$/)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: payTo.match(/^0x[a-fA-F0-9]{40}$/) ? '#ff9800' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: payTo.match(/^0x[a-fA-F0-9]{40}$/) ? 'pointer' : 'not-allowed',
              }}
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div>
          <h2>Review & Create</h2>
          <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px', marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>{name}</h3>
            <p style={{ margin: '0 0 1rem', color: '#666' }}>{description || 'No description'}</p>
            <table style={{ width: '100%', fontSize: '0.875rem' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Upstream</td>
                  <td>{selectedUpstream?.name || 'Unknown'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Upstream Cost</td>
                  <td>{selectedUpstream ? formatPrice(selectedUpstream.priceAmount) : '-'} / message</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Your Price</td>
                  <td>
                    ${priceAmount} / {pricingMode === 'per_message' ? 'message' : 'session'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Tags</td>
                  <td>{tags || 'None'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Pay To</td>
                  <td style={{ fontFamily: 'monospace' }}>{payTo}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px', marginBottom: '1rem' }}>
            <strong>Note:</strong> An agent wallet will be created for this remix.
            You'll need to fund it with testnet tokens before the remix can make upstream calls.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setStep('pricing')}
              style={{ padding: '0.75rem 1.5rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: isSubmitting ? '#ccc' : '#ff9800',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Remix Module'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Success */}
      {step === 'success' && agentWallet && (
        <div>
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#e8f5e9', borderRadius: '8px', marginBottom: '1rem' }}>
            <h2 style={{ color: '#2e7d32', margin: '0 0 1rem' }}>Remix Created Successfully!</h2>
            <p>Your remix module has been created. Now you need to fund the agent wallet.</p>
          </div>

          <div style={{ padding: '1.5rem', backgroundColor: '#fff3e0', borderRadius: '8px', marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#e65100' }}>Agent Wallet - Fund This Address</h3>
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fff',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                wordBreak: 'break-all',
                border: '2px dashed #ff9800',
              }}
            >
              {agentWallet.address}
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
              {agentWallet.fundingInstructions}
            </p>
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fffde7', borderRadius: '4px' }}>
              <strong>How to fund (testnet):</strong>
              <ol style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, fontSize: '0.875rem' }}>
                <li>Go to a Cronos Testnet faucet (e.g., https://faucet.cronos.org)</li>
                <li>Copy the address above</li>
                <li>Request testnet tCRO (gas) and devUSDC.e (payment token)</li>
                <li>Wait for confirmation</li>
                <li>Your remix can now pay the upstream module!</li>
              </ol>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link
              href={`/seller/modules/${createdModuleId}`}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ff9800',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              View Module
            </Link>
            <Link
              href="/seller"
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
