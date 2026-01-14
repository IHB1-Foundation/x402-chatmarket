import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPool } from '../lib/db.js';
import { getConfig } from '../config.js';

const CreateModuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(2000).default(''),
  tags: z.array(z.string().max(50)).max(10).default([]),
  personaPrompt: z.string().max(10000).default(''),
  pricingMode: z.enum(['per_message', 'per_session']),
  priceAmount: z
    .string()
    .regex(/^\d+$/, 'Price must be a non-negative integer string')
    .refine((val) => BigInt(val) > 0n, 'Price must be greater than 0'),
  sessionPolicy: z
    .object({
      minutes: z.number().int().positive().optional(),
      messageCredits: z.number().int().positive().optional(),
    })
    .optional(),
  payTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid pay_to address'),
});

type CreateModuleRequest = z.infer<typeof CreateModuleSchema>;

export async function sellerRoutes(fastify: FastifyInstance): Promise<void> {
  // Create module draft
  fastify.post<{ Body: CreateModuleRequest }>(
    '/api/seller/modules',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: CreateModuleRequest }>, reply: FastifyReply) => {
      const parseResult = CreateModuleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const {
        name,
        description,
        tags,
        personaPrompt,
        pricingMode,
        priceAmount,
        sessionPolicy,
        payTo,
      } = parseResult.data;

      // Validate session policy for per_session pricing
      if (pricingMode === 'per_session' && !sessionPolicy) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: [{ path: ['sessionPolicy'], message: 'Session policy is required for per_session pricing' }],
        });
      }

      const user = request.user as { sub: string; address: string; role: string };
      const config = getConfig();
      const pool = getPool();

      const result = await pool.query(
        `INSERT INTO modules (
          owner_user_id,
          type,
          name,
          description,
          tags,
          status,
          persona_prompt,
          pricing_mode,
          price_amount,
          session_policy,
          pay_to,
          network,
          asset_contract
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, owner_user_id, type, name, description, tags, status,
                  persona_prompt, pricing_mode, price_amount, session_policy,
                  pay_to, network, asset_contract, created_at, updated_at`,
        [
          user.sub,
          'base',
          name,
          description,
          tags,
          'draft',
          personaPrompt,
          pricingMode,
          priceAmount,
          sessionPolicy ? JSON.stringify(sessionPolicy) : null,
          payTo,
          config.X402_NETWORK,
          config.X402_ASSET_CONTRACT || '',
        ]
      );

      const module = result.rows[0];

      return reply.status(201).send({
        id: module.id,
        ownerUserId: module.owner_user_id,
        type: module.type,
        name: module.name,
        description: module.description,
        tags: module.tags,
        status: module.status,
        personaPrompt: module.persona_prompt,
        pricingMode: module.pricing_mode,
        priceAmount: module.price_amount,
        sessionPolicy: module.session_policy,
        payTo: module.pay_to,
        network: module.network,
        assetContract: module.asset_contract,
        createdAt: module.created_at,
        updatedAt: module.updated_at,
      });
    }
  );

  // List seller's modules
  fastify.get(
    '/api/seller/modules',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { sub: string; address: string; role: string };
      const pool = getPool();

      const result = await pool.query(
        `SELECT id, type, name, description, tags, status,
                pricing_mode, price_amount, pay_to, network, asset_contract,
                eval_score, created_at, updated_at
         FROM modules
         WHERE owner_user_id = $1
         ORDER BY created_at DESC`,
        [user.sub]
      );

      const modules = result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        description: row.description,
        tags: row.tags,
        status: row.status,
        pricingMode: row.pricing_mode,
        priceAmount: row.price_amount,
        payTo: row.pay_to,
        network: row.network,
        assetContract: row.asset_contract,
        evalScore: row.eval_score,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return reply.send({ modules });
    }
  );

  // Get single module detail (seller view)
  fastify.get<{ Params: { id: string } }>(
    '/api/seller/modules/:id',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };
      const pool = getPool();

      const result = await pool.query(
        `SELECT id, owner_user_id, type, name, description, tags, status,
                persona_prompt, pricing_mode, price_amount, session_policy,
                pay_to, network, asset_contract, upstream_module_id, remix_policy,
                eval_score, last_eval_at, created_at, updated_at
         FROM modules
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = result.rows[0];

      // Check ownership
      if (module.owner_user_id !== user.sub) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      return reply.send({
        id: module.id,
        ownerUserId: module.owner_user_id,
        type: module.type,
        name: module.name,
        description: module.description,
        tags: module.tags,
        status: module.status,
        personaPrompt: module.persona_prompt,
        pricingMode: module.pricing_mode,
        priceAmount: module.price_amount,
        sessionPolicy: module.session_policy,
        payTo: module.pay_to,
        network: module.network,
        assetContract: module.asset_contract,
        upstreamModuleId: module.upstream_module_id,
        remixPolicy: module.remix_policy,
        evalScore: module.eval_score,
        lastEvalAt: module.last_eval_at,
        createdAt: module.created_at,
        updatedAt: module.updated_at,
      });
    }
  );
}
