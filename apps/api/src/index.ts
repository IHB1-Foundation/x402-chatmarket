import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Module } from '@soulforge/shared';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
});

fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
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
