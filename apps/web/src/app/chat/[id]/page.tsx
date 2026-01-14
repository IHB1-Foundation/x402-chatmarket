'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAccount, useConnect, useDisconnect, useSignTypedData } from 'wagmi';
import { getClientX402Config } from '../../../lib/x402-config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PaymentInfo {
  txHash?: string;
  from?: string;
  to?: string;
  value?: string;
  network?: string;
}

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  pricingMode: string;
  priceAmount: string;
  payTo: string;
  network: string;
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const moduleId = params.id as string;
  const tryMode = searchParams.get('mode') === 'try';

  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signTypedDataAsync } = useSignTypedData();

  const x402Config = useMemo(() => getClientX402Config(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [module, setModule] = useState<ModuleInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [moduleLoading, setModuleLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [paymentRequirements, setPaymentRequirements] = useState<any>(null);

  // Fetch module info
  useEffect(() => {
    const fetchModule = async () => {
      try {
        const res = await fetch(`${API_URL}/api/modules/${moduleId}`);
        if (res.ok) {
          setModule(await res.json());
        } else {
          setError('Module not found');
        }
      } catch {
        setError('Failed to load module');
      } finally {
        setModuleLoading(false);
      }
    };
    fetchModule();
  }, [moduleId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatPrice = (amount: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)}`;
  };

  const buildPaymentHeader = async (requirements: any): Promise<string> => {
    if (!address) throw new Error('Wallet not connected');

    const { domain, types } = x402Config;

    const validAfter = Math.floor(Date.now() / 1000);
    const validBefore = validAfter + (requirements.maxTimeoutSeconds || 300);
    const nonce = Date.now();

    const messageToSign = {
      from: address,
      to: requirements.payTo as `0x${string}`,
      value: BigInt(requirements.maxAmountRequired),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: BigInt(nonce),
    };

    const signature = await signTypedDataAsync({
      domain,
      types,
      primaryType: 'PaymentAuthorization',
      message: messageToSign,
    });

    const payload = {
      signature,
      payload: {
        from: address,
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter,
        validBefore,
        nonce,
        network: requirements.network,
        asset: requirements.asset,
      },
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  };

  const sendMessage = async (messageText: string, paymentHeader?: string) => {
    if (!messageText.trim()) return;

    setLoading(true);
    setError(null);

    // Add user message to UI immediately
    const userMessage: Message = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (address) {
        headers['X-WALLET-ADDRESS'] = address;
      }

      if (paymentHeader) {
        headers['X-PAYMENT'] = paymentHeader;
      }

      const res = await fetch(`${API_URL}/api/modules/${moduleId}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId,
          message: messageText,
          mode: tryMode && !paymentHeader ? 'try' : 'paid',
        }),
      });

      const data = await res.json();

      if (res.status === 402) {
        // Payment required
        setPaymentRequirements(data.paymentRequirements);
        setPendingMessage(messageText);
        setShowPaymentModal(true);
        // Remove user message since we'll retry
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Success
      if (data.chatId) setChatId(data.chatId);
      if (data.payment) setPaymentInfo(data.payment);

      const assistantMessage: Message = { role: 'assistant', content: data.reply };
      setMessages((prev) => [...prev, assistantMessage]);
      setInput('');

      if (data.isTryOnce) {
        setError('Free preview complete. Pay to continue chatting.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!paymentRequirements || !pendingMessage) return;

    setLoading(true);
    setShowPaymentModal(false);

    try {
      const paymentHeader = await buildPaymentHeader(paymentRequirements);
      await sendMessage(pendingMessage, paymentHeader);
      setPendingMessage(null);
      setPaymentRequirements(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  if (moduleLoading) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (!module) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/marketplace" style={{ color: '#0070f3' }}>&larr; Back to Marketplace</Link>
        <h1>Module Not Found</h1>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <Link href={`/marketplace/${moduleId}`} style={{ color: '#0070f3' }}>&larr; Back to Module</Link>
        <h1 style={{ margin: '0.5rem 0' }}>{module.name}</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.875rem', color: '#666' }}>
          <span>{formatPrice(module.priceAmount)} / {module.pricingMode === 'per_message' ? 'message' : 'session'}</span>
          {tryMode && <span style={{ color: '#ef6c00' }}>Free Preview Mode</span>}
          {isConnected ? (
            <span style={{ color: 'green' }}>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
          ) : (
            <button onClick={() => connect({ connector: connectors[0] })} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', backgroundColor: '#f9f9f9' }}>
        {messages.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center' }}>Start a conversation with {module.name}</p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  backgroundColor: msg.role === 'user' ? '#0070f3' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  border: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Payment Info */}
      {paymentInfo && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#e8f5e9', borderRadius: '8px', fontSize: '0.875rem' }}>
          <strong>Payment Confirmed</strong>
          <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            TX: {paymentInfo.txHash?.slice(0, 10)}...{paymentInfo.txHash?.slice(-8)}
            {' | '}
            {formatPrice(paymentInfo.value || '0')}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage(input)}
          placeholder="Type your message..."
          disabled={loading}
          style={{ flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: loading || !input.trim() ? '#ccc' : '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && paymentRequirements && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
          }}>
            <h2 style={{ margin: '0 0 1rem' }}>Payment Required</h2>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              {paymentRequirements.description}
            </p>
            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0070f3' }}>
                {formatPrice(paymentRequirements.maxAmountRequired)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                Network: {paymentRequirements.network}
              </div>
            </div>
            {!isConnected ? (
              <div>
                <p style={{ color: '#666', marginBottom: '0.5rem' }}>Connect wallet to pay:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      onClick={() => connect({ connector })}
                      style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {connector.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  style={{ flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePay}
                  disabled={loading}
                  style={{
                    flex: 2,
                    padding: '0.75rem',
                    backgroundColor: '#0070f3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Processing...' : 'Pay & Send'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
