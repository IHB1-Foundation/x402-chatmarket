import { randomBytes } from 'crypto';
import { SiweMessage } from 'siwe';
import { getRedis } from '../lib/redis.js';

const NONCE_TTL = 300; // 5 minutes

export async function generateNonce(address: string): Promise<string> {
  const nonce = randomBytes(16).toString('hex');
  const redis = getRedis();
  await redis.set(`siwe:nonce:${address}`, nonce, 'EX', NONCE_TTL);
  return nonce;
}

export async function verifyNonce(address: string, nonce: string): Promise<boolean> {
  const redis = getRedis();
  const storedNonce = await redis.get(`siwe:nonce:${address}`);
  if (storedNonce !== nonce) {
    return false;
  }
  // Delete nonce after use (one-time)
  await redis.del(`siwe:nonce:${address}`);
  return true;
}

interface VerifySiweResult {
  success: boolean;
  address?: string;
  error?: string;
}

export async function verifySiweMessage(
  message: string,
  signature: string
): Promise<VerifySiweResult> {
  try {
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (!fields.success) {
      return { success: false, error: 'Invalid signature' };
    }

    const address = siweMessage.address.toLowerCase();

    // Verify nonce was issued by us
    const nonceValid = await verifyNonce(address, siweMessage.nonce);
    if (!nonceValid) {
      return { success: false, error: 'Invalid or expired nonce' };
    }

    return { success: true, address };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `SIWE verification failed: ${errorMsg}` };
  }
}
