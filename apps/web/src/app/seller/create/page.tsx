'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useSellerAuth } from '../../../hooks/useSellerAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type WizardStep = 'basics' | 'persona' | 'knowledge' | 'pricing' | 'review';

interface QAItem {
  question: string;
  answer: string;
}

export default function CreateModulePage() {
  const router = useRouter();
  const { address } = useAccount();
  const { isAuthenticated, getAuthHeaders } = useSellerAuth();

  const [step, setStep] = useState<WizardStep>('basics');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [personaPrompt, setPersonaPrompt] = useState('');
  const [qaItems, setQaItems] = useState<QAItem[]>([{ question: '', answer: '' }]);
  const [pricingMode, setPricingMode] = useState<'per_message' | 'per_session'>('per_message');
  const [priceAmount, setPriceAmount] = useState('0.01');
  const [sessionMinutes, setSessionMinutes] = useState('30');
  const [sessionCredits, setSessionCredits] = useState('10');
  const [payTo, setPayTo] = useState(address || '');

  // Update payTo when address changes
  useState(() => {
    if (address && !payTo) setPayTo(address);
  });

  if (!isAuthenticated) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Create Module</h1>
        <p>Please sign in first.</p>
        <Link href="/seller" style={{ color: '#0070f3' }}>
          Go to Seller Dashboard
        </Link>
      </main>
    );
  }

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'persona', label: 'Persona' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'review', label: 'Review' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const addQAItem = () => {
    setQaItems([...qaItems, { question: '', answer: '' }]);
  };

  const updateQAItem = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...qaItems];
    updated[index][field] = value;
    setQaItems(updated);
  };

  const removeQAItem = (index: number) => {
    if (qaItems.length > 1) {
      setQaItems(qaItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Convert price to smallest units (assuming 6 decimals)
      const priceInSmallestUnits = Math.round(parseFloat(priceAmount) * 1e6).toString();

      // Create module
      const createRes = await fetch(`${API_URL}/api/seller/modules`, {
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
          personaPrompt,
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

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.error || 'Failed to create module');
      }

      const { id: moduleId } = await createRes.json();

      // Add Q/A items if any valid ones exist
      const validQA = qaItems.filter((qa) => qa.question.trim() && qa.answer.trim());
      if (validQA.length > 0) {
        const qaRes = await fetch(`${API_URL}/api/seller/modules/${moduleId}/qa`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ items: validQA }),
        });

        if (!qaRes.ok) {
          console.warn('Failed to add Q/A items');
        }
      }

      // Redirect to module detail
      router.push(`/seller/modules/${moduleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create module');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '700px', margin: '0 auto' }}>
      <Link href="/seller" style={{ color: '#0070f3', display: 'inline-block', marginBottom: '1rem' }}>
        &larr; Back to Dashboard
      </Link>

      <h1>Create New Module</h1>

      {/* Progress Steps */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        {steps.map((s, i) => (
          <div
            key={s.id}
            style={{
              flex: 1,
              padding: '0.5rem',
              textAlign: 'center',
              backgroundColor: i <= currentStepIndex ? '#0070f3' : '#e0e0e0',
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

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Step: Basics */}
      {step === 'basics' && (
        <div>
          <h2>Basic Information</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My AI Assistant"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A helpful AI assistant that..."
              rows={4}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="assistant, helpful, coding"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <button
            onClick={() => setStep('persona')}
            disabled={!name.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: name.trim() ? '#0070f3' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Next: Persona
          </button>
        </div>
      )}

      {/* Step: Persona */}
      {step === 'persona' && (
        <div>
          <h2>Persona Prompt</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Define the personality, style, and constraints for your AI module.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>System Prompt</label>
            <textarea
              value={personaPrompt}
              onChange={(e) => setPersonaPrompt(e.target.value)}
              placeholder="You are a helpful assistant that specializes in..."
              rows={8}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setStep('basics')}
              style={{ padding: '0.75rem 1.5rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={() => setStep('knowledge')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Next: Knowledge
            </button>
          </div>
        </div>
      )}

      {/* Step: Knowledge */}
      {step === 'knowledge' && (
        <div>
          <h2>Knowledge Base (Q&A)</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Add question-answer pairs that your module should know. You can add more knowledge later.
          </p>
          {qaItems.map((qa, index) => (
            <div key={index} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>Q&A #{index + 1}</strong>
                {qaItems.length > 1 && (
                  <button
                    onClick={() => removeQAItem(index)}
                    style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                type="text"
                value={qa.question}
                onChange={(e) => updateQAItem(index, 'question', e.target.value)}
                placeholder="Question..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '0.5rem' }}
              />
              <textarea
                value={qa.answer}
                onChange={(e) => updateQAItem(index, 'answer', e.target.value)}
                placeholder="Answer..."
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          ))}
          <button
            onClick={addQAItem}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '1rem',
            }}
          >
            + Add Another Q&A
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setStep('persona')}
              style={{ padding: '0.75rem 1.5rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={() => setStep('pricing')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0070f3',
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
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
              Payments will be sent to this address
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setStep('knowledge')}
              style={{ padding: '0.75rem 1.5rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!payTo.match(/^0x[a-fA-F0-9]{40}$/)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: payTo.match(/^0x[a-fA-F0-9]{40}$/) ? '#0070f3' : '#ccc',
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
          <div style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px', marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>{name}</h3>
            <p style={{ margin: '0 0 1rem', color: '#666' }}>{description || 'No description'}</p>
            <table style={{ width: '100%', fontSize: '0.875rem' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Tags</td>
                  <td>{tags || 'None'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Pricing</td>
                  <td>
                    ${priceAmount} / {pricingMode === 'per_message' ? 'message' : 'session'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Q&A Items</td>
                  <td>{qaItems.filter((q) => q.question.trim()).length}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666' }}>Pay To</td>
                  <td style={{ fontFamily: 'monospace' }}>{payTo}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Your module will be created as a <strong>draft</strong>. You can publish it after reviewing.
          </p>
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
                backgroundColor: isSubmitting ? '#ccc' : '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Module'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
