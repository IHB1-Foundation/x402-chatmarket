import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Module } from '@soulforge/shared';
import { checkDbConnection, checkPgvector } from './lib/db.js';
import { checkRedisConnection } from './lib/redis.js';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
});

fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/health/db', async (request, reply) => {
  const [dbCheck, pgvectorCheck, redisCheck] = await Promise.all([
    checkDbConnection(),
    checkPgvector(),
    checkRedisConnection(),
  ]);

  const allOk = dbCheck.ok && pgvectorCheck.ok && redisCheck.ok;
  const status = allOk ? 'ok' : 'degraded';

  const response = {
    status,
    timestamp: new Date().toISOString(),
    services: {
      postgres: dbCheck,
      pgvector: pgvectorCheck,
      redis: redisCheck,
    },
  };

  reply.status(allOk ? 200 : 503).send(response);
});

fastify.get('/api/test-shared', async () => {
  const testModule: Partial<Module> = {
    id: 'test-id',
    name: 'Test Module',
    type: 'base',
    status: 'draft',
  };
  return { message: 'Shared package works!', testModule };
});

const port = parseInt(process.env.API_PORT || '3001', 10);
const host = process.env.API_HOST || '0.0.0.0';

try {
  await fastify.listen({ port, host });
  console.log(`API server running on http://${host}:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
