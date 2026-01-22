'use client';

import React, { useState, useMemo } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import type { PaymentRequirements } from '@soulforge/shared';
import { getClientX402Config } from '../../lib/x402-config';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { CopyButton } from '../../components/ui/CopyButton';
import { useToast } from '../../components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type FlowStep = 'idle' | 'requesting' | 'got-402' | 'signing' | 'retrying' | 'success' | 'error';

interface DebugLog {
  timestamp: string;
  type: 'request' | 'response' | 'info' | 'error';
  message: string;
  data?: Record<string, unknown> | string | null;
}

const STEPS = [
  { id: 'requesting', label: 'Request', icon: '1' },
  { id: 'got-402', label: '402 Received', icon: '2' },
  { id: 'signing', label: 'Sign', icon: '3' },
  { id: 'retrying', label: 'Retry', icon: '4' },
  { id: 'success', label: 'Success', icon: '5' },
];

function getStepStatus(step: string, currentStep: FlowStep): 'completed' | 'active' | 'upcoming' | 'error' {
  const stepOrder = ['requesting', 'got-402', 'signing', 'retrying', 'success'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(step);

  if (currentStep === 'error') return stepIndex <= currentIndex ? 'error' : 'upcoming';
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'upcoming';
}

export default function X402PocPage(): React.ReactElement {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { showToast } = useToast();

  const x402Config = useMemo(() => getClientX402Config(), []);
  const [message, setMessage] = useState('Hello from x402 POC!');
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<Record<string, unknown> | null>(null);
  const [currentStep, setCurrentStep] = useState<FlowStep>('idle');
  const [showDebug, setShowDebug] = useState(true);
  const [paymentReqs, setPaymentReqs] = useState<PaymentRequirements | null>(null);

  const addLog = (type: DebugLog['type'], message: string, data?: Record<string, unknown> | string | null) => {
    setLogs((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), type, message, data },
    ]);
  };

  const buildPaymentHeader = async (requirements: PaymentRequirements): Promise<string> => {
    if (!address) throw new Error('Wallet not connected');

    const { domain, types } = x402Config;

    const validAfter = Math.floor(Date.now() / 1000);
    const validBefore = validAfter + requirements.maxTimeoutSeconds;
    const nonce = Date.now();

    const messageToSign = {
      from: address,
      to: requirements.payTo as `0x${string}`,
      value: BigInt(requirements.maxAmountRequired),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: BigInt(nonce),
    };

    addLog('info', 'Requesting wallet signature...', {
      domain: { ...domain },
      types: { ...types },
    });

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

  const callPremiumEcho = async () => {
    if (!isConnected) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    setIsLoading(true);
    setLogs([]);
    setLastResponse(null);
    setPaymentReqs(null);
    setCurrentStep('requesting');

    try {
      // First call - expect 402
      addLog('request', 'Calling /api/premium/echo without payment...', { message });

      const response1 = await fetch(`${API_URL}/api/premium/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data1 = await response1.json();

      if (response1.status === 402) {
        setCurrentStep('got-402');
        addLog('response', `Got 402 Payment Required`, data1);

        const requirements = data1.paymentRequirements as PaymentRequirements;
        setPaymentReqs(requirements);

        // Build payment header with wallet signature
        setCurrentStep('signing');
        addLog('info', 'Building payment header with wallet signature...');
        const paymentHeader = await buildPaymentHeader(requirements);
        addLog('info', 'Payment header built successfully');

        // Retry with payment header
        setCurrentStep('retrying');
        addLog('request', 'Retrying with X-PAYMENT header...', { paymentHeader: paymentHeader.slice(0, 50) + '...' });

        const response2 = await fetch(`${API_URL}/api/premium/echo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-PAYMENT': paymentHeader,
          },
          body: JSON.stringify({ message }),
        });

        const data2 = await response2.json();
        setLastResponse(data2);

        if (response2.ok) {
          setCurrentStep('success');
          addLog('response', `SUCCESS! Got 200 response`, data2);
          showToast('x402 flow completed successfully!', 'success');
        } else {
          setCurrentStep('error');
          addLog('error', `Got ${response2.status} on retry`, data2);
          showToast(`Payment failed: ${data2.error || 'Unknown error'}`, 'error');
        }
      } else if (response1.ok) {
        addLog('response', `Got 200 (unexpected - payment not required?)`, data1);
        setLastResponse(data1);
        setCurrentStep('success');
      } else {
        setCurrentStep('error');
        addLog('error', `Got ${response1.status}`, data1);
        showToast(`Request failed: ${data1.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      setCurrentStep('error');
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addLog('error', `Error: ${errorMsg}`);
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (amount: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="container-narrow py-8 animate-fade-in">
      <div className="text-center mb-8">
        <Badge variant="primary" className="mb-4">Interactive Demo</Badge>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          x402 Payment Flow
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Experience the 402 Payment Required → Sign → Pay → Success flow
        </p>
      </div>

      {/* Visual Stepper */}
      <Card variant="bordered" padding="lg" className="mb-6">
        <div className="flex items-center justify-between overflow-x-auto">
          {STEPS.map((step, index) => {
            const status = getStepStatus(step.id, currentStep);
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center min-w-[80px]">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                      transition-all duration-300
                      ${status === 'completed' ? 'bg-[var(--color-success)] text-white' : ''}
                      ${status === 'active' ? 'bg-[var(--color-primary)] text-white animate-pulse-subtle' : ''}
                      ${status === 'upcoming' ? 'bg-[var(--color-border)] text-[var(--color-text-tertiary)]' : ''}
                      ${status === 'error' ? 'bg-[var(--color-error)] text-white' : ''}
                    `}
                  >
                    {status === 'completed' ? '✓' : status === 'error' ? '✗' : step.icon}
                  </div>
                  <span
                    className={`
                      mt-2 text-xs font-medium text-center
                      ${status === 'active' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}
                    `}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`
                      flex-1 h-0.5 mx-2
                      ${getStepStatus(STEPS[index + 1].id, currentStep) === 'upcoming'
                        ? 'bg-[var(--color-border)]'
                        : 'bg-[var(--color-success)]'
                      }
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          {/* Wallet Connection */}
          <Card variant="bordered" padding="md">
            <h2 className="font-semibold text-[var(--color-text-primary)] mb-3">
              1. Connect Wallet
            </h2>
            {isConnected ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Connected</Badge>
                  <span className="text-sm font-mono text-[var(--color-text-secondary)]">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="warning">Not connected</Badge>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Connect MetaMask using the button in the header to continue.
                </p>
              </div>
            )}
          </Card>

          {/* Message Input */}
          <Card variant="bordered" padding="md">
            <h2 className="font-semibold text-[var(--color-text-primary)] mb-3">
              2. Test Message
            </h2>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message to echo"
              fullWidth
            />
          </Card>

          {/* Execute Button */}
          <Card variant="bordered" padding="md">
            <h2 className="font-semibold text-[var(--color-text-primary)] mb-3">
              3. Execute Flow
            </h2>
            <Button
              onClick={callPremiumEcho}
              disabled={!isConnected || isLoading}
              isLoading={isLoading}
              fullWidth
              size="lg"
            >
              {isLoading ? 'Processing...' : 'Start x402 Payment Flow'}
            </Button>
            {!isConnected && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-2 text-center">
                Connect your wallet to start
              </p>
            )}
          </Card>
        </div>

        {/* Right Column - Payment Requirements */}
        <div className="space-y-6">
          {paymentReqs ? (
            <Card variant="bordered" padding="md" className="border-2 border-[var(--color-primary)]">
              <h2 className="font-semibold text-[var(--color-text-primary)] mb-3">
                Payment Requirements (402 Response)
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <dt className="text-[var(--color-text-tertiary)]">Amount</dt>
                  <dd className="font-bold text-[var(--color-primary)]">
                    {formatPrice(paymentReqs.maxAmountRequired)}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-[var(--color-text-tertiary)]">Network</dt>
                  <dd className="font-mono">{paymentReqs.network}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-[var(--color-text-tertiary)]">Asset</dt>
                  <dd className="font-mono flex items-center gap-1">
                    {paymentReqs.asset.slice(0, 8)}...
                    <CopyButton text={paymentReqs.asset} label="asset" />
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-[var(--color-text-tertiary)]">Pay To</dt>
                  <dd className="font-mono flex items-center gap-1">
                    {paymentReqs.payTo.slice(0, 8)}...
                    <CopyButton text={paymentReqs.payTo} label="payTo" />
                  </dd>
                </div>
              </dl>
            </Card>
          ) : (
            <Card variant="bordered" padding="md" className="text-center py-8">
              <p className="text-[var(--color-text-tertiary)]">
                Payment requirements will appear here after the first request
              </p>
            </Card>
          )}

          {/* Final Response */}
          {lastResponse && (
            <Card variant="bordered" padding="md" className="bg-[var(--color-success-light)]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-[var(--color-success)]">
                  Final Response
                </h2>
                <CopyButton
                  text={JSON.stringify(lastResponse, null, 2)}
                  label="response"
                  showText
                />
              </div>
              <pre className="text-xs font-mono bg-[var(--color-surface)] p-3 rounded-[var(--radius-md)] overflow-x-auto">
                {JSON.stringify(lastResponse, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      </div>

      {/* Debug Panel */}
      <Card variant="bordered" padding="none" className="mt-6">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-background-secondary)] transition-colors"
        >
          <span className="font-semibold text-[var(--color-text-primary)]">
            Debug Panel
          </span>
          <span className="text-[var(--color-text-tertiary)]">
            {showDebug ? '▼' : '▶'} {logs.length} logs
          </span>
        </button>
        {showDebug && (
          <div className="border-t border-[var(--color-border)]">
            <div
              className="bg-[#1a1a2e] text-[#f0f0f0] p-4 font-mono text-xs max-h-[300px] overflow-auto"
            >
              {logs.length === 0 ? (
                <p className="text-[var(--color-text-tertiary)]">
                  No logs yet. Click "Start x402 Payment Flow" to begin.
                </p>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`
                      mb-2 pl-2 border-l-2
                      ${log.type === 'error' ? 'border-[var(--color-error)]' : ''}
                      ${log.type === 'response' ? 'border-[var(--color-success)]' : ''}
                      ${log.type === 'request' ? 'border-[var(--color-primary)]' : ''}
                      ${log.type === 'info' ? 'border-[var(--color-warning)]' : ''}
                    `}
                  >
                    <span className="text-[#888]">
                      [{log.timestamp.split('T')[1].split('.')[0]}]
                    </span>{' '}
                    <span className={log.type === 'error' ? 'text-[var(--color-error)]' : ''}>
                      {log.message}
                    </span>
                    {log.data && (
                      <pre className="mt-1 text-[#aaa] whitespace-pre-wrap break-all">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Curl Example */}
      <Card variant="bordered" padding="md" className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[var(--color-text-primary)]">
            curl Example
          </h2>
          <CopyButton
            text={`curl -X POST ${API_URL}/api/premium/echo -H "Content-Type: application/json" -d '{"message": "${message}"}'`}
            label="curl"
            showText
          />
        </div>
        <pre className="text-xs font-mono bg-[var(--color-background-secondary)] p-3 rounded-[var(--radius-md)] overflow-x-auto">
{`curl -X POST ${API_URL}/api/premium/echo \\
  -H "Content-Type: application/json" \\
  -d '{"message": "${message}"}'`}
        </pre>
      </Card>
    </div>
  );
}
