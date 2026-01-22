import { getConfig } from '../config.js';
import type { PaymentRequirements } from '@soulforge/shared';

interface VerifyResult {
  valid: boolean;
  error?: string;
  payer?: string;
  value?: string;
}

interface SettleResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export function buildPaymentRequirements(
  payTo: string,
  amount: string,
  description: string
): PaymentRequirements {
  const config = getConfig();

  const normalizeAddress = (value: string): string => {
    if (/^0x[a-fA-F0-9]{40}$/.test(value)) return value.toLowerCase();
    return value;
  };

  return {
    scheme: 'exact',
    network: config.X402_NETWORK,
    payTo: normalizeAddress(payTo),
    asset: normalizeAddress(
      config.X402_ASSET_CONTRACT || '0x0000000000000000000000000000000000000000'
    ),
    description,
    mimeType: 'application/json',
    maxAmountRequired: amount,
    maxTimeoutSeconds: 300,
  };
}

export async function verifyPayment(paymentHeader: string): Promise<VerifyResult> {
  const config = getConfig();

  if (config.X402_MOCK_MODE) {
    // Mock mode: decode base64 header and validate structure
    try {
      const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      if (!decoded.signature || !decoded.payload) {
        return { valid: false, error: 'Invalid payment structure' };
      }
      return {
        valid: true,
        payer: decoded.payload.from || '0xMockPayer',
        value: decoded.payload.value || '10000',
      };
    } catch {
      return { valid: false, error: 'Failed to decode payment header' };
    }
  }

  // Real mode: call facilitator
  const facilitatorUrl = config.X402_FACILITATOR_BASE_URL;
  if (!facilitatorUrl) {
    return { valid: false, error: 'X402_FACILITATOR_BASE_URL not configured' };
  }

  try {
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment: paymentHeader }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { valid: false, error: `Verify failed: ${response.status} ${errorText}` };
    }

    const result = await response.json() as { valid: boolean; payer?: string; value?: string };
    return {
      valid: result.valid,
      payer: result.payer,
      value: result.value,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `Verify request failed: ${msg}` };
  }
}

export async function settlePayment(paymentHeader: string): Promise<SettleResult> {
  const config = getConfig();

  if (config.X402_MOCK_MODE) {
    // Mock mode: simulate successful settlement
    return {
      success: true,
      txHash: `0xmock${Date.now().toString(16)}`,
    };
  }

  // Real mode: call facilitator
  const facilitatorUrl = config.X402_FACILITATOR_BASE_URL;
  if (!facilitatorUrl) {
    return { success: false, error: 'X402_FACILITATOR_BASE_URL not configured' };
  }

  try {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment: paymentHeader }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Settle failed: ${response.status} ${errorText}` };
    }

    const result = await response.json() as { success: boolean; txHash?: string };
    return {
      success: result.success,
      txHash: result.txHash,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Settle request failed: ${msg}` };
  }
}
