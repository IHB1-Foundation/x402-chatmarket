import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { generateNonce, verifySiweMessage } from '../services/auth.js';
import { getPool } from '../lib/db.js';
import { getConfig } from '../config.js';

const NonceRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

const VerifyRequestSchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Get nonce for SIWE
  fastify.post<{ Body: z.infer<typeof NonceRequestSchema> }>(
    '/api/auth/nonce',
    async (request: FastifyRequest<{ Body: z.infer<typeof NonceRequestSchema> }>, reply: FastifyReply) => {
      const parseResult = NonceRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const { address } = parseResult.data;
      const nonce = await generateNonce(address.toLowerCase());

      return reply.send({ nonce });
    }
  );

  // Verify SIWE signature and issue JWT
  fastify.post<{ Body: z.infer<typeof VerifyRequestSchema> }>(
    '/api/auth/verify',
    async (request: FastifyRequest<{ Body: z.infer<typeof VerifyRequestSchema> }>, reply: FastifyReply) => {
      const parseResult = VerifyRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const { message, signature } = parseResult.data;
      const result = await verifySiweMessage(message, signature);

      if (!result.success) {
        return reply.status(401).send({
          error: 'Authentication failed',
          details: result.error,
        });
      }

      const address = result.address!;

      // Get or create user in database
      const pool = getPool();
      const userResult = await pool.query(
        `INSERT INTO users (wallet_address, role)
         VALUES ($1, 'seller')
         ON CONFLICT (wallet_address) DO UPDATE SET updated_at = NOW()
         RETURNING id, wallet_address, role`,
        [address]
      );

      const user = userResult.rows[0];

      // Generate JWT
      const token = fastify.jwt.sign(
        {
          sub: user.id,
          address: user.wallet_address,
          role: user.role,
        },
        { expiresIn: '24h' }
      );

      return reply.send({
        token,
        user: {
          id: user.id,
          address: user.wallet_address,
          role: user.role,
        },
      });
    }
  );

  // Get current user (protected route example)
  fastify.get(
    '/api/auth/me',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { sub: string; address: string; role: string };
      return reply.send({
        id: user.sub,
        address: user.address,
        role: user.role,
      });
    }
  );
}
