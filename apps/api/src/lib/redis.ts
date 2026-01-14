import Redis from 'ioredis';

let redis: Redis.Redis | null = null;

export function getRedis(): Redis.Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    redis = new Redis.default(redisUrl);
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
