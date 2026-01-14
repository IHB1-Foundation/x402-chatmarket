'use client';

import React, { useState, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect, useSignTypedData } from 'wagmi';
import type { PaymentRequirements } from '@soulforge/shared';
import { getClientX402Config } from '../../lib/x402-config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DebugLog {
  timestamp: string;
  type: 'request' | 'response' | 'info' | 'error';
  message: string;
  data?: Record<string, unknown> | string | null;
}

export default function X402PocPage(): React.ReactElement {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signTypedDataAsync } = useSignTypedData();

  const x402Config = useMemo(() => getClientX402Config(), []);
  const [message, setMessage] = useState('Hello from x402 POC!');
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<Record<string, unknown> | null>(null);

  const addLog = (type: DebugLog['type'], message: string, data?: Record<string, unknown> | string | null) => {
    setLogs((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), type, message, data },
    ]);
  };

  const buildPaymentHeader = async (requirements: PaymentRequirements): Promise<string> => {
    if (!address) throw new Error('Wallet not connected');

    // Use config-driven EIP-712 domain and types
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

    // Encode payment header as base64 JSON
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
      addLog('error', 'Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setLogs([]);

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
        addLog('response', `Got 402 Payment Required`, data1);

        const requirements = data1.paymentRequirements as PaymentRequirements;

        // Build payment header with wallet signature
        addLog('info', 'Building payment header with wallet signature...');
        const paymentHeader = await buildPaymentHeader(requirements);
        addLog('info', 'Payment header built successfully');

        // Retry with payment header
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
          addLog('response', `SUCCESS! Got 200 response`, data2);
        } else {
          addLog('error', `Got ${response2.status} on retry`, data2);
        }
      } else if (response1.ok) {
        addLog('response', `Got 200 (unexpected - payment not required?)`, data1);
        setLastResponse(data1);
      } else {
        addLog('error', `Got ${response1.status}`, data1);
      }
    } catch (err) {
      addLog('error', `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '900px', margin: '0 auto' }}>
      <h1>x402 POC - Payment Flow Demo</h1>
      <p style={{ color: '#666' }}>
        This page demonstrates the x402 payment flow: 402 → wallet sign → retry with X-PAYMENT → 200
      </p>

      <hr style={{ margin: '1.5rem 0' }} />

      {/* Wallet Connection */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>1. Connect Wallet</h2>
        {isConnected ? (
          <div>
            <p style={{ color: 'green' }}>Connected: {address}</p>
            <button onClick={() => disconnect()} style={{ padding: '0.5rem 1rem' }}>
              Disconnect
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                style={{ padding: '0.5rem 1rem' }}
              >
                Connect {connector.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Message Input */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>2. Test Message</h2>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ padding: '0.5rem', width: '100%', maxWidth: '400px' }}
          placeholder="Enter message to echo"
        />
      </section>

      {/* Call Button */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>3. Execute Payment Flow</h2>
        <button
          onClick={callPremiumEcho}
          disabled={!isConnected || isLoading}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            backgroundColor: isConnected ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            cursor: isConnected && !isLoading ? 'pointer' : 'not-allowed',
          }}
        >
          {isLoading ? 'Processing...' : 'Call Premium Echo (with x402 flow)'}
        </button>
      </section>

      {/* Debug Panel */}
      <section>
        <h2>Debug Panel</h2>
        <div
          style={{
            backgroundColor: '#1a1a1a',
            color: '#f0f0f0',
            padding: '1rem',
            borderRadius: '4px',
            maxHeight: '400px',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
          }}
        >
          {logs.length === 0 ? (
            <p style={{ color: '#666' }}>No logs yet. Click the button above to start.</p>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '0.5rem',
                  borderLeft: `3px solid ${
                    log.type === 'error'
                      ? '#ff4444'
                      : log.type === 'response'
                      ? '#44ff44'
                      : log.type === 'request'
                      ? '#4444ff'
                      : '#ffff44'
                  }`,
                  paddingLeft: '0.5rem',
                }}
              >
                <span style={{ color: '#888' }}>[{log.timestamp.split('T')[1].split('.')[0]}]</span>{' '}
                <span style={{ color: log.type === 'error' ? '#ff4444' : '#fff' }}>{log.message}</span>
                {log.data && (
                  <pre style={{ margin: '0.25rem 0 0 0', color: '#aaa', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Final Response */}
      {lastResponse && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>Final Response</h2>
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: '1rem',
              borderRadius: '4px',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(lastResponse, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
