import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Module } from '@soulforge/shared';
import { getConfig } from './config.js';
import { checkDbConnection, checkPgvector } from './lib/db.js';
import { checkRedisConnection } from './lib/redis.js';
import { authPlugin } from './plugins/auth.js';
import { observabilityPlugin } from './plugins/observability.js';
import { premiumRoutes } from './routes/premium.js';
import { authRoutes } from './routes/auth.js';
import { testLLMRoutes } from './routes/test-llm.js';
import { sellerRoutes } from './routes/seller.js';
import { modulesRoutes } from './routes/modules.js';
import { chatRoutes } from './routes/chat.js';
import { adminRoutes } from './routes/admin.js';

// Validate config early - will exit if invalid
const config = getConfig();

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
});

// Register observability plugin (request IDs, structured logging)
await fastify.register(observabilityPlugin);

// Register auth plugin (JWT)
await fastify.register(authPlugin);

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

// Register routes
await fastify.register(authRoutes);
await fastify.register(premiumRoutes);
await fastify.register(testLLMRoutes);
await fastify.register(sellerRoutes);
await fastify.register(modulesRoutes);
await fastify.register(chatRoutes);
await fastify.register(adminRoutes);

try {
  await fastify.listen({ port: config.API_PORT, host: config.API_HOST });
  console.log(`API server running on http://${config.API_HOST}:${config.API_PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
