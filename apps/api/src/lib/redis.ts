import Redis from 'ioredis';
import { getConfig } from '../config.js';

let redis: Redis.Redis | null = null;

export function getRedis(): Redis.Redis {
  if (!redis) {
    const config = getConfig();
    redis = new Redis.default(config.REDIS_URL);
  }
  return redis;
}

export async function checkRedisConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = getRedis();
    const pong = await r.ping();
    return { ok: pong === 'PONG' };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error };
  }
}
