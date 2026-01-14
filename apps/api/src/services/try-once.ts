import { getRedis } from '../lib/redis.js';

const TRY_ONCE_PREFIX = 'tryonce:';
const TRY_ONCE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface TryOnceIdentifier {
  moduleId: string;
  walletAddress?: string;
  ipAddress?: string;
}

// Build the Redis key for try-once tracking
function buildKey(moduleId: string, identifier: string): string {
  return `${TRY_ONCE_PREFIX}${moduleId}:${identifier}`;
}

// Check if a user is eligible for free try
export async function checkTryOnceEligible(params: TryOnceIdentifier): Promise<{
  eligible: boolean;
  reason?: string;
  usedAt?: string;
}> {
  const { moduleId, walletAddress, ipAddress } = params;

  if (!walletAddress && !ipAddress) {
    return { eligible: false, reason: 'No identifier provided' };
  }

  const redis = getRedis();

  // Check wallet-based key first (more specific)
  if (walletAddress) {
    const walletKey = buildKey(moduleId, `wallet:${walletAddress.toLowerCase()}`);
    const walletUsed = await redis.get(walletKey);
    if (walletUsed) {
      return { eligible: false, reason: 'Free try already used for this wallet', usedAt: walletUsed };
    }
  }

  // Check IP-based key
  if (ipAddress) {
    const ipKey = buildKey(moduleId, `ip:${ipAddress}`);
    const ipUsed = await redis.get(ipKey);
    if (ipUsed) {
      return { eligible: false, reason: 'Free try already used for this IP', usedAt: ipUsed };
    }
  }

  return { eligible: true };
}

// Record that a user has used their free try
export async function recordTryOnceUsage(params: TryOnceIdentifier): Promise<void> {
  const { moduleId, walletAddress, ipAddress } = params;
  const redis = getRedis();
  const timestamp = new Date().toISOString();

  const pipeline = redis.pipeline();

  // Record for wallet
  if (walletAddress) {
    const walletKey = buildKey(moduleId, `wallet:${walletAddress.toLowerCase()}`);
    pipeline.setex(walletKey, TRY_ONCE_TTL_SECONDS, timestamp);
  }

  // Record for IP
  if (ipAddress) {
    const ipKey = buildKey(moduleId, `ip:${ipAddress}`);
    pipeline.setex(ipKey, TRY_ONCE_TTL_SECONDS, timestamp);
  }

  await pipeline.exec();
}

// Get remaining time until try-once expires (for UI display)
export async function getTryOnceExpiry(params: TryOnceIdentifier): Promise<number | null> {
  const { moduleId, walletAddress, ipAddress } = params;
  const redis = getRedis();

  // Check wallet-based key first
  if (walletAddress) {
    const walletKey = buildKey(moduleId, `wallet:${walletAddress.toLowerCase()}`);
    const ttl = await redis.ttl(walletKey);
    if (ttl > 0) return ttl;
  }

  // Check IP-based key
  if (ipAddress) {
    const ipKey = buildKey(moduleId, `ip:${ipAddress}`);
    const ttl = await redis.ttl(ipKey);
    if (ttl > 0) return ttl;
  }

  return null;
}

// Clear try-once record (for testing/admin)
export async function clearTryOnceUsage(params: TryOnceIdentifier): Promise<void> {
  const { moduleId, walletAddress, ipAddress } = params;
  const redis = getRedis();

  const keysToDelete: string[] = [];

  if (walletAddress) {
    keysToDelete.push(buildKey(moduleId, `wallet:${walletAddress.toLowerCase()}`));
  }

  if (ipAddress) {
    keysToDelete.push(buildKey(moduleId, `ip:${ipAddress}`));
  }

  if (keysToDelete.length > 0) {
    await redis.del(...keysToDelete);
  }
}

// Output limits for free try (to prevent abuse)
export const TRY_ONCE_LIMITS = {
  maxOutputTokens: 150, // Shorter responses for free try
  maxOutputChars: 500,  // Character limit for response
};

// Truncate response if needed for free try
export function truncateForTryOnce(response: string): string {
  if (response.length <= TRY_ONCE_LIMITS.maxOutputChars) {
    return response;
  }

  // Find a good break point
  const truncated = response.slice(0, TRY_ONCE_LIMITS.maxOutputChars);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > TRY_ONCE_LIMITS.maxOutputChars * 0.8) {
    return truncated.slice(0, lastSpace) + '... [Preview truncated. Pay to see full response]';
  }

  return truncated + '... [Preview truncated. Pay to see full response]';
}
