import { getConfig } from '../config.js';
import type { PaymentRequirements } from '@soulforge/shared';
import { randomBytes } from 'crypto';
import { getAddress, type Address } from 'viem';

interface VerifyResult {
  valid: boolean;
  error?: string;
  payer?: string;
  value?: string;
}

type SettleResult =
  | { success: true; txHash: string; isMock?: boolean }
  | { success: false; error: string };

export function buildPaymentRequirements(
  payTo: string,
  amount: string,
  description: string
): PaymentRequirements {
  const config = getConfig();

  const normalizeAddress = (value: string): string => {
    if (/^0x[a-fA-F0-9]{40}$/.test(value)) return getAddress(value.toLowerCase() as Address);
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

function decodePaymentHeader(paymentHeader: string): {
  payer?: string;
  value?: string;
  error?: string;
} {
  try {
    const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString()) as {
      payload?: { from?: string; value?: string };
    };
    return {
      payer: decoded?.payload?.from,
      value: decoded?.payload?.value,
    };
  } catch {
    return { error: 'Failed to decode payment header' };
  }
}

export async function verifyPayment(
  paymentHeader: string,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResult> {
  const config = getConfig();

  if (config.X402_MOCK_MODE) {
    const decoded = decodePaymentHeader(paymentHeader);
    if (decoded.error) return { valid: false, error: decoded.error };
    if (!decoded.payer || !decoded.value) return { valid: false, error: 'Invalid payment structure' };
    return { valid: true, payer: decoded.payer, value: decoded.value };
  }

  // Real mode: call facilitator
  const facilitatorUrl = config.X402_FACILITATOR_BASE_URL;
  if (!facilitatorUrl) {
    return { valid: false, error: 'X402_FACILITATOR_BASE_URL not configured' };
  }

  try {
    const decoded = decodePaymentHeader(paymentHeader);
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X402-Version': '1',
      },
      body: JSON.stringify({
        x402Version: 1,
        paymentHeader,
        paymentRequirements,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        valid: false,
        payer: decoded.payer,
        value: decoded.value,
        error: `Verify failed: ${response.status} ${errorText}`,
      };
    }

    const result = (await response.json()) as
      | { isValid: boolean; invalidReason: string | null }
      | { valid: boolean; payer?: string; value?: string }
      | { status: string; error?: string };

    if ('isValid' in result && typeof result.isValid === 'boolean') {
      return {
        valid: result.isValid,
        payer: decoded.payer,
        value: decoded.value,
        error: result.isValid ? undefined : result.invalidReason || 'Payment verification failed',
      };
    }

    if ('valid' in result && typeof result.valid === 'boolean') {
      return {
        valid: result.valid,
        payer: result.payer ?? decoded.payer,
        value: result.value ?? decoded.value,
      };
    }

    return {
      valid: false,
      payer: decoded.payer,
      value: decoded.value,
      error:
        'error' in result && typeof result.error === 'string'
          ? result.error
          : 'Unexpected verify response',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `Verify request failed: ${msg}` };
  }
}

export async function settlePayment(
  paymentHeader: string,
  paymentRequirements: PaymentRequirements
): Promise<SettleResult> {
  const config = getConfig();

  if (config.X402_MOCK_MODE) {
    // Mock mode: simulate successful settlement
    return {
      success: true,
      isMock: true,
      txHash: `0x${randomBytes(32).toString('hex')}`,
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
      headers: {
        'Content-Type': 'application/json',
        'X402-Version': '1',
      },
      body: JSON.stringify({
        x402Version: 1,
        paymentHeader,
        paymentRequirements,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Settle failed: ${response.status} ${errorText}` };
    }

    const result = (await response.json()) as
      | { event: 'payment.settled'; txHash: string }
      | { event: 'payment.failed'; error: string }
      | { success: boolean; txHash?: string; error?: string };

    const isTxHash = (value: unknown): value is string =>
      typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value);

    if ('event' in result) {
      if (result.event === 'payment.settled') {
        if (!isTxHash(result.txHash)) {
          return { success: false, error: 'Settlement returned invalid txHash' };
        }
        return { success: true, txHash: result.txHash };
      }
      return { success: false, error: result.error || 'Payment settlement failed' };
    }

    if ('success' in result && typeof result.success === 'boolean') {
      if (result.success) {
        if (!isTxHash(result.txHash)) {
          return { success: false, error: 'Settlement returned success without a valid txHash' };
        }
        return { success: true, txHash: result.txHash };
      }
      return { success: false, error: result.error || 'Payment settlement failed' };
    }

    return { success: false, error: 'Unexpected settle response' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Settle request failed: ${msg}` };
  }
}
