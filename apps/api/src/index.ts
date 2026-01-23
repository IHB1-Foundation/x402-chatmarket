import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Module } from '@soulforge/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from './config.js';
import { checkDbConnection, checkPgvector } from './lib/db.js';
import { ensureDemoSeed } from './lib/demo-seed.js';
import { ensureDbSchema } from './lib/schema.js';
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

async function loadEnvFile(filePath: string): Promise<void> {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    // If the file doesn't exist, ignore silently (e.g., production environments)
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'ENOENT'
    ) {
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`WARN: Failed to load .env file at ${filePath}: ${msg}`);
  }
}

// Load local env file if present (pnpm --filter api dev runs with cwd=apps/api)
await loadEnvFile(path.resolve(process.cwd(), '.env'));
// For Railway deployments we keep a tracked env file (demo-friendly, non-secret defaults)
await loadEnvFile(path.resolve(process.cwd(), '.env.railway'));

// Validate config early - will exit if invalid
const config = getConfig();
let schemaInit: Awaited<ReturnType<typeof ensureDbSchema>> = { method: 'pending' };
let demoSeed: Awaited<ReturnType<typeof ensureDemoSeed>> = {
  attempted: false,
  seeded: false,
  reason: 'pending',
};
let ready = false;
let initAttempts = 0;
let lastInitError: string | null = null;

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

// Block non-health traffic until DB/schema init is ready.
fastify.addHook('preHandler', async (request, reply) => {
  if (ready) return;
  if (request.url.startsWith('/health')) return;

  return reply.status(503).send({
    error: 'Service initializing',
    details: {
      ready,
      initAttempts,
      lastInitError,
      schema: schemaInit,
      seed: demoSeed,
    },
  });
});

fastify.get('/health', async () => {
  return { status: ready ? 'ok' : 'initializing', ready, timestamp: new Date().toISOString() };
});

fastify.get('/health/version', async () => {
  return {
    status: ready ? 'ok' : 'initializing',
    ready,
    timestamp: new Date().toISOString(),
    schema: schemaInit,
    seed: demoSeed,
    git: {
      sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      branch: process.env.RAILWAY_GIT_BRANCH ?? null,
    },
  };
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

  // Initialize DB schema + demo seed in the background.
  // This prevents startup hangs (PaaS expects the app to start listening quickly).
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  void (async () => {
    while (!ready) {
      initAttempts += 1;

      schemaInit = await ensureDbSchema();
      if (schemaInit.method === 'error') {
        lastInitError = schemaInit.error || 'DB schema init error';
        fastify.log.error(
          { attempt: initAttempts, error: lastInitError },
          'DB schema init failed'
        );
      } else {
        lastInitError = null;
        ready = true;
        fastify.log.info({ method: schemaInit.method }, 'DB schema ensured');
      }

      // Best-effort demo seeding (non-fatal)
      demoSeed = await ensureDemoSeed();
      if (demoSeed.attempted) {
        fastify.log.info({ seeded: demoSeed.seeded, reason: demoSeed.reason }, 'Demo seed result');
      }

      if (!ready) {
        const delayMs = Math.min(30_000, 1_000 * Math.pow(2, Math.min(initAttempts, 5)));
        await sleep(delayMs);
      }
    }
  })();
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
