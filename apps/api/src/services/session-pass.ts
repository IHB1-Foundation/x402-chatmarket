import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { getRedis } from '../lib/redis.js';
import { getConfig } from '../config.js';

const SESSION_PASS_PREFIX = 'sessionpass:';
const DEV_JWT_SECRET = 'insecure-dev-secret-change-in-production';

function getJwtSecret(): string {
  const config = getConfig();
  return config.JWT_SECRET || DEV_JWT_SECRET;
}

export interface SessionPolicy {
  minutes: number;
  messageCredits: number;
}

export interface SessionPassPayload {
  sub: string; // wallet address
  moduleId: string;
  paymentTxHash: string;
  creditsRemaining: number;
  maxCredits: number;
  issuedAt: number;
  expiresAt: number;
}

export interface SessionPassInfo {
  token: string;
  creditsRemaining: number;
  maxCredits: number;
  expiresAt: number;
}

export interface ValidateResult {
  valid: boolean;
  payload?: SessionPassPayload;
  error?: string;
}

/**
 * Issue a session pass after successful payment
 */
export async function issueSessionPass(params: {
  walletAddress: string;
  moduleId: string;
  paymentTxHash: string;
  sessionPolicy: SessionPolicy;
}): Promise<SessionPassInfo> {
  const { walletAddress, moduleId, paymentTxHash, sessionPolicy } = params;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + sessionPolicy.minutes * 60;

  const payload: SessionPassPayload = {
    sub: walletAddress.toLowerCase(),
    moduleId,
    paymentTxHash,
    creditsRemaining: sessionPolicy.messageCredits,
    maxCredits: sessionPolicy.messageCredits,
    issuedAt: now,
    expiresAt,
  };

  const token = jwt.sign(payload, getJwtSecret(), {
    expiresIn: sessionPolicy.minutes * 60,
  });

  // Store credits in Redis for tracking consumption
  const redisKey = buildRedisKey(moduleId, walletAddress, paymentTxHash);
  const redis = getRedis();
  await redis.setex(redisKey, sessionPolicy.minutes * 60, sessionPolicy.messageCredits.toString());

  return {
    token,
    creditsRemaining: sessionPolicy.messageCredits,
    maxCredits: sessionPolicy.messageCredits,
    expiresAt,
  };
}

/**
 * Validate and decode a session pass
 */
export async function validateSessionPass(token: string): Promise<ValidateResult> {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload & SessionPassPayload;
    const payload: SessionPassPayload = {
      sub: decoded.sub || '',
      moduleId: decoded.moduleId,
      paymentTxHash: decoded.paymentTxHash,
      creditsRemaining: decoded.creditsRemaining,
      maxCredits: decoded.maxCredits,
      issuedAt: decoded.issuedAt,
      expiresAt: decoded.expiresAt,
    };

    // Check if expired (redundant with JWT but explicit)
    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt < now) {
      return { valid: false, error: 'Session pass expired' };
    }

    // Get current credits from Redis
    const redisKey = buildRedisKey(payload.moduleId, payload.sub, payload.paymentTxHash);
    const redis = getRedis();
    const creditsStr = await redis.get(redisKey);

    if (creditsStr === null) {
      // Redis key expired or never existed
      return { valid: false, error: 'Session pass not found or expired' };
    }

    const creditsRemaining = parseInt(creditsStr, 10);
    if (creditsRemaining <= 0) {
      return { valid: false, error: 'Session pass credits exhausted' };
    }

    // Update payload with current credits
    payload.creditsRemaining = creditsRemaining;

    return { valid: true, payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'Session pass expired' };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'Invalid session pass token' };
    }
    return { valid: false, error: 'Session pass validation failed' };
  }
}

/**
 * Consume one credit from a session pass
 */
export async function consumeSessionCredit(params: {
  moduleId: string;
  walletAddress: string;
  paymentTxHash: string;
}): Promise<{ creditsRemaining: number }> {
  const { moduleId, walletAddress, paymentTxHash } = params;

  const redisKey = buildRedisKey(moduleId, walletAddress, paymentTxHash);
  const redis = getRedis();

  // Decrement and get new value
  const newCredits = await redis.decr(redisKey);

  return { creditsRemaining: Math.max(0, newCredits) };
}

/**
 * Get remaining credits for a session pass
 */
export async function getSessionCredits(params: {
  moduleId: string;
  walletAddress: string;
  paymentTxHash: string;
}): Promise<number | null> {
  const { moduleId, walletAddress, paymentTxHash } = params;

  const redisKey = buildRedisKey(moduleId, walletAddress, paymentTxHash);
  const redis = getRedis();

  const creditsStr = await redis.get(redisKey);
  if (creditsStr === null) return null;

  return parseInt(creditsStr, 10);
}

/**
 * Build Redis key for session pass credits
 */
function buildRedisKey(moduleId: string, walletAddress: string, paymentTxHash: string): string {
  return `${SESSION_PASS_PREFIX}${moduleId}:${walletAddress.toLowerCase()}:${paymentTxHash}`;
}

/**
 * Check if a module supports session pass mode
 */
export function supportsSessionPass(pricingMode: string, sessionPolicy: SessionPolicy | null): boolean {
  return pricingMode === 'per_session' && sessionPolicy !== null;
}

/**
 * Default session policy for per_message modules (optional upgrade)
 */
export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  minutes: 30,
  messageCredits: 10,
};
