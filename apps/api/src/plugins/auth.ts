import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; address: string; role: string };
    user: { sub: string; address: string; role: string };
  }
}

export async function authPlugin(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  const jwtSecret = config.JWT_SECRET;
  if (!jwtSecret) {
    console.warn('WARNING: JWT_SECRET not set, using insecure default for development');
  }

  await fastify.register(fastifyJwt, {
    secret: jwtSecret || 'insecure-dev-secret-change-in-production',
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token',
      });
    }
  });
}
