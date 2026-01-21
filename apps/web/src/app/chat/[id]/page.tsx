'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAccount, useConnect, useDisconnect, useSignTypedData } from 'wagmi';
import { getClientX402Config } from '../../../lib/x402-config';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';

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

interface SessionPassInfo {
  token: string;
  creditsRemaining: number;
  maxCredits: number;
  expiresAt: number;
}

interface UpstreamPaymentInfo {
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
  const [sessionPass, setSessionPass] = useState<SessionPassInfo | null>(null);
  const [upstreamPayment, setUpstreamPayment] = useState<UpstreamPaymentInfo | null>(null);

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

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

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

  const isSessionPassValid = () => {
    if (!sessionPass) return false;
    const now = Math.floor(Date.now() / 1000);
    return sessionPass.expiresAt > now && sessionPass.creditsRemaining > 0;
  };

  const sendMessage = async (messageText: string, paymentHeader?: string) => {
    if (!messageText.trim()) return;

    setLoading(true);
    setError(null);

    const userMessage: Message = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (address) {
        headers['X-WALLET-ADDRESS'] = address;
      }

      if (isSessionPassValid() && sessionPass) {
        headers['X-SESSION-PASS'] = sessionPass.token;
      } else if (paymentHeader) {
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
        setPaymentRequirements(data.paymentRequirements);
        setPendingMessage(messageText);
        setShowPaymentModal(true);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      if (data.chatId) setChatId(data.chatId);
      if (data.payment) setPaymentInfo(data.payment);
      if (data.upstreamPayment) setUpstreamPayment(data.upstreamPayment);

      if (data.sessionPass) {
        if (data.sessionPass.token) {
          setSessionPass(data.sessionPass);
        } else if (data.sessionPass.creditsRemaining !== undefined) {
          setSessionPass((prev) =>
            prev
              ? { ...prev, creditsRemaining: data.sessionPass.creditsRemaining }
              : null
          );
        }
      }

      const assistantMessage: Message = { role: 'assistant', content: data.reply };
      setMessages((prev) => [...prev, assistantMessage]);
      setInput('');

      if (data.isTryOnce) {
        setError('Free preview complete. Pay to continue chatting.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
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
      <div className="container-narrow py-8">
        <Skeleton variant="text" width={120} height={20} className="mb-4" />
        <Skeleton variant="text" width={200} height={32} className="mb-2" />
        <Skeleton variant="text" width={160} height={16} className="mb-8" />
        <Skeleton variant="rounded" width="100%" height={400} />
      </div>
    );
  }

  if (!module) {
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
          <Link href="/marketplace">
            <Button variant="secondary">Browse Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-narrow py-8 min-h-[calc(100vh-12rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="mb-4">
        <Link
          href={`/marketplace/${moduleId}`}
          className="inline-flex items-center gap-2 text-[var(--color-primary)] hover:underline text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Module
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              {module.name}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="text-[var(--color-text-secondary)]">
                {formatPrice(module.priceAmount)} / {module.pricingMode === 'per_message' ? 'msg' : 'session'}
              </span>
              {tryMode && (
                <Badge variant="warning" size="sm">Free Preview</Badge>
              )}
            </div>
          </div>
          <div>
            {isConnected ? (
              <Badge variant="success" size="sm">
                {formatAddress(address!)}
              </Badge>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => connect({ connector: connectors[0] })}
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <Card variant="bordered" padding="none" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-background-secondary)]">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[var(--color-text-tertiary)]">
              Start a conversation with {module.name}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[70%] px-4 py-3 rounded-[var(--radius-lg)]
                      ${msg.role === 'user'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)]'
                      }
                    `}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Info Banners */}
        <div className="border-t border-[var(--color-border)]">
          {paymentInfo && (
            <div className="px-4 py-2 bg-[var(--color-success-light)] text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[var(--color-success)] font-medium">Payment Confirmed</span>
              <span className="text-[var(--color-text-secondary)] font-mono text-xs ml-2">
                TX: {paymentInfo.txHash?.slice(0, 10)}...{paymentInfo.txHash?.slice(-6)} | {formatPrice(paymentInfo.value || '0')}
              </span>
            </div>
          )}

          {upstreamPayment && (
            <div className="px-4 py-2 bg-[var(--color-warning-light)] text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[var(--color-warning)] font-medium">Upstream Payment (Remix)</span>
              <span className="text-[var(--color-text-secondary)] font-mono text-xs ml-2">
                TX: {upstreamPayment.txHash?.slice(0, 10)}... | {formatPrice(upstreamPayment.value || '0')} → {formatAddress(upstreamPayment.to || '')}
              </span>
            </div>
          )}

          {sessionPass && (
            <div className={`px-4 py-2 text-sm flex items-center gap-2 ${
              isSessionPassValid() ? 'bg-[var(--color-primary-light)]' : 'bg-[var(--color-warning-light)]'
            }`}>
              <span className="font-medium text-[var(--color-text-primary)]">Session Pass</span>
              <Badge variant={isSessionPassValid() ? 'primary' : 'warning'} size="sm">
                {sessionPass.creditsRemaining}/{sessionPass.maxCredits} credits
              </Badge>
              <span className="text-[var(--color-text-tertiary)] text-xs">
                Expires: {new Date(sessionPass.expiresAt * 1000).toLocaleTimeString()}
              </span>
              {!isSessionPassValid() && (
                <span className="text-[var(--color-warning)] text-xs">(Payment required)</span>
              )}
            </div>
          )}

          {error && (
            <div className="px-4 py-2 bg-[var(--color-error-light)] text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage(input)}
              placeholder="Type your message..."
              disabled={loading}
              fullWidth
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              isLoading={loading}
            >
              Send
            </Button>
          </div>
        </div>
      </Card>

      {/* Payment Modal */}
      {showPaymentModal && paymentRequirements && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full animate-slide-up">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
              Payment Required
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-4">
              {paymentRequirements.description}
            </p>
            <div className="p-4 bg-[var(--color-background-secondary)] rounded-[var(--radius-md)] mb-4">
              <div className="text-2xl font-bold text-[var(--color-primary)]">
                {formatPrice(paymentRequirements.maxAmountRequired)}
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Network: {paymentRequirements.network}
              </div>
            </div>
            {!isConnected ? (
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  Connect your wallet to pay:
                </p>
                <div className="space-y-2">
                  {connectors.map((connector) => (
                    <Button
                      key={connector.uid}
                      variant="secondary"
                      fullWidth
                      onClick={() => connect({ connector })}
                    >
                      {connector.name}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  fullWidth
                  onClick={handlePay}
                  isLoading={loading}
                >
                  Pay & Send
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
