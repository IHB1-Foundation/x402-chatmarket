import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPool } from '../lib/db.js';
import { getConfig } from '../config.js';
import {
  ingestQAPairs,
  ingestDocuments,
  retrieveTopK,
  deleteModuleDocuments,
  countModuleDocuments,
} from '../services/knowledge.js';
import { testRAG } from '../services/rag.js';
import { createAgentWallet, getAgentWallet } from '../services/agent-wallet.js';
import {
  getEvalCases,
  addEvalCases,
  deleteEvalCases,
  runEval,
  getLatestEvalRun,
  getEvalRuns,
} from '../services/eval.js';

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

  // Publish module
  fastify.post<{ Params: { id: string } }>(
    '/api/seller/modules/:id/publish',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };
      const pool = getPool();

      // Get module and verify ownership
      const moduleResult = await pool.query(
        'SELECT id, owner_user_id, status, name FROM modules WHERE id = $1',
        [id]
      );

      if (moduleResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = moduleResult.rows[0];

      if (module.owner_user_id !== user.sub) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (module.status === 'published') {
        return reply.status(400).send({ error: 'Module is already published' });
      }

      if (module.status === 'blocked') {
        return reply.status(400).send({ error: 'Cannot publish a blocked module' });
      }

      // Update status to published
      const result = await pool.query(
        `UPDATE modules SET status = 'published', updated_at = NOW()
         WHERE id = $1
         RETURNING id, status, updated_at`,
        [id]
      );

      return reply.send({
        id: result.rows[0].id,
        status: result.rows[0].status,
        message: `Module "${module.name}" has been published`,
        updatedAt: result.rows[0].updated_at,
      });
    }
  );

  // Unpublish module (return to draft)
  fastify.post<{ Params: { id: string } }>(
    '/api/seller/modules/:id/unpublish',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };
      const pool = getPool();

      // Get module and verify ownership
      const moduleResult = await pool.query(
        'SELECT id, owner_user_id, status, name FROM modules WHERE id = $1',
        [id]
      );

      if (moduleResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = moduleResult.rows[0];

      if (module.owner_user_id !== user.sub) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (module.status === 'draft') {
        return reply.status(400).send({ error: 'Module is already a draft' });
      }

      if (module.status === 'blocked') {
        return reply.status(400).send({ error: 'Cannot unpublish a blocked module' });
      }

      // Update status to draft
      const result = await pool.query(
        `UPDATE modules SET status = 'draft', updated_at = NOW()
         WHERE id = $1
         RETURNING id, status, updated_at`,
        [id]
      );

      return reply.send({
        id: result.rows[0].id,
        status: result.rows[0].status,
        message: `Module "${module.name}" has been unpublished`,
        updatedAt: result.rows[0].updated_at,
      });
    }
  );

  // Knowledge ingestion schemas
  const AddQASchema = z.object({
    items: z
      .array(
        z.object({
          question: z.string().min(1).max(500),
          answer: z.string().min(1).max(2000),
        })
      )
      .min(1)
      .max(200),
  });

  const AddDocumentsSchema = z.object({
    documents: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          content: z.string().min(1).max(50000),
        })
      )
      .min(1)
      .max(20),
  });

  const TestRetrievalSchema = z.object({
    query: z.string().min(1).max(500),
    k: z.number().int().positive().max(20).default(5),
  });

  // Helper to verify module ownership
  async function verifyModuleOwnership(moduleId: string, userId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query('SELECT owner_user_id FROM modules WHERE id = $1', [moduleId]);
    return result.rows.length > 0 && result.rows[0].owner_user_id === userId;
  }

  // Add Q/A pairs to module
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof AddQASchema> }>(
    '/api/seller/modules/:id/qa',
    { preValidation: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof AddQASchema> }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      // Verify ownership
      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const parseResult = AddQASchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const { items } = parseResult.data;

      try {
        const stored = await ingestQAPairs(id, items);
        return reply.status(201).send({
          message: `Successfully added ${stored.length} Q/A pairs`,
          count: stored.length,
          documents: stored.map((d) => ({
            id: d.id,
            title: d.title,
            sourceType: d.sourceType,
            createdAt: d.createdAt,
          })),
        });
      } catch (err) {
        fastify.log.error(err, 'Failed to ingest Q/A pairs');
        return reply.status(500).send({ error: 'Failed to ingest Q/A pairs' });
      }
    }
  );

  // Add documents to module
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof AddDocumentsSchema> }>(
    '/api/seller/modules/:id/documents',
    { preValidation: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof AddDocumentsSchema> }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      // Verify ownership
      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const parseResult = AddDocumentsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const { documents } = parseResult.data;

      try {
        const stored = await ingestDocuments(id, documents);
        return reply.status(201).send({
          message: `Successfully added ${stored.length} document chunks`,
          count: stored.length,
          documents: stored.map((d) => ({
            id: d.id,
            title: d.title,
            sourceType: d.sourceType,
            createdAt: d.createdAt,
          })),
        });
      } catch (err) {
        fastify.log.error(err, 'Failed to ingest documents');
        return reply.status(500).send({ error: 'Failed to ingest documents' });
      }
    }
  );

  // List module documents
  fastify.get<{ Params: { id: string } }>(
    '/api/seller/modules/:id/documents',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      // Verify ownership
      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const pool = getPool();
      const result = await pool.query(
        `SELECT id, source_type, title, content, created_at
         FROM module_documents
         WHERE module_id = $1
         ORDER BY created_at DESC`,
        [id]
      );

      return reply.send({
        count: result.rows.length,
        documents: result.rows.map((row) => ({
          id: row.id,
          sourceType: row.source_type,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
        })),
      });
    }
  );

  // Delete all documents for module
  fastify.delete<{ Params: { id: string } }>(
    '/api/seller/modules/:id/documents',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      // Verify ownership
      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const deleted = await deleteModuleDocuments(id);
      return reply.send({
        message: `Deleted ${deleted} documents`,
        count: deleted,
      });
    }
  );

  // Test retrieval (for verification)
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof TestRetrievalSchema> }>(
    '/api/seller/modules/:id/retrieve',
    { preValidation: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof TestRetrievalSchema> }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      // Verify ownership
      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const parseResult = TestRetrievalSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const { query, k } = parseResult.data;

      try {
        const results = await retrieveTopK(id, query, k);
        return reply.send({
          query,
          k,
          results: results.map((r) => ({
            id: r.id,
            sourceType: r.sourceType,
            title: r.title,
            content: r.content,
            similarity: r.similarity,
          })),
        });
      } catch (err) {
        fastify.log.error(err, 'Failed to retrieve documents');
        return reply.status(500).send({ error: 'Failed to retrieve documents' });
      }
    }
  );

  // Test RAG pipeline (for verification)
  const TestRAGSchema = z.object({
    query: z.string().min(1).max(500),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof TestRAGSchema> }>(
    '/api/seller/modules/:id/test-rag',
    { preValidation: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof TestRAGSchema> }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      // Verify ownership
      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const parseResult = TestRAGSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const { query } = parseResult.data;

      try {
        const result = await testRAG(id, query);
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err, 'Failed to execute RAG');
        return reply.status(500).send({ error: 'Failed to execute RAG pipeline' });
      }
    }
  );

  // ==================== REMIX MODULE ENDPOINTS ====================

  const CreateRemixSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(2000).default(''),
    tags: z.array(z.string().max(50)).max(10).default([]),
    upstreamModuleId: z.string().uuid('Invalid upstream module ID'),
    deltaPersonaPrompt: z.string().max(10000).default(''),
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
    remixPolicy: z
      .object({
        upstreamWeight: z.number().min(0).max(1).default(0.5),
        appendMode: z.enum(['before', 'after', 'replace']).default('after'),
      })
      .optional()
      .default({}),
  });

  type CreateRemixRequest = z.infer<typeof CreateRemixSchema>;

  // Create remix module
  fastify.post<{ Body: CreateRemixRequest }>(
    '/api/seller/remix',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: CreateRemixRequest }>, reply: FastifyReply) => {
      const parseResult = CreateRemixSchema.safeParse(request.body);
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
        upstreamModuleId,
        deltaPersonaPrompt,
        pricingMode,
        priceAmount,
        sessionPolicy,
        payTo,
        remixPolicy,
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

      // Verify upstream module exists and is published
      const upstreamResult = await pool.query(
        `SELECT id, name, status, pay_to, price_amount, pricing_mode, network, asset_contract
         FROM modules WHERE id = $1`,
        [upstreamModuleId]
      );

      if (upstreamResult.rows.length === 0) {
        return reply.status(400).send({
          error: 'Upstream module not found',
        });
      }

      const upstreamModule = upstreamResult.rows[0];

      if (upstreamModule.status !== 'published') {
        return reply.status(400).send({
          error: 'Upstream module is not published',
        });
      }

      // Create the remix module in a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insert remix module
        const moduleResult = await client.query(
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
            asset_contract,
            upstream_module_id,
            remix_policy
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id, owner_user_id, type, name, description, tags, status,
                    persona_prompt, pricing_mode, price_amount, session_policy,
                    pay_to, network, asset_contract, upstream_module_id, remix_policy,
                    created_at, updated_at`,
          [
            user.sub,
            'remix',
            name,
            description,
            tags,
            'draft',
            deltaPersonaPrompt,
            pricingMode,
            priceAmount,
            sessionPolicy ? JSON.stringify(sessionPolicy) : null,
            payTo,
            config.X402_NETWORK,
            config.X402_ASSET_CONTRACT || '',
            upstreamModuleId,
            JSON.stringify({
              ...remixPolicy,
              upstreamModuleId,
              upstreamPayTo: upstreamModule.pay_to,
              upstreamPriceAmount: upstreamModule.price_amount,
            }),
          ]
        );

        const module = moduleResult.rows[0];

        // Create agent wallet for the remix module
        let agentWallet;
        try {
          agentWallet = await createAgentWallet(module.id);
        } catch (walletErr) {
          // If wallet creation fails, rollback and return error
          await client.query('ROLLBACK');
          fastify.log.error(walletErr, 'Failed to create agent wallet');
          return reply.status(500).send({
            error: 'Failed to create agent wallet. Ensure AGENT_WALLET_ENCRYPTION_KEY is configured.',
          });
        }

        await client.query('COMMIT');

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
          upstreamModuleId: module.upstream_module_id,
          remixPolicy: module.remix_policy,
          createdAt: module.created_at,
          updatedAt: module.updated_at,
          agentWallet: {
            address: agentWallet.walletAddress,
            fundingInstructions: `Fund this wallet with testnet tokens to enable remix payments. Address: ${agentWallet.walletAddress}`,
          },
          upstream: {
            id: upstreamModule.id,
            name: upstreamModule.name,
            payTo: upstreamModule.pay_to,
            priceAmount: upstreamModule.price_amount,
          },
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  );

  // Get agent wallet info for a remix module
  fastify.get<{ Params: { id: string } }>(
    '/api/seller/modules/:id/agent-wallet',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };
      const pool = getPool();

      // Get module and verify ownership
      const moduleResult = await pool.query(
        'SELECT id, owner_user_id, type FROM modules WHERE id = $1',
        [id]
      );

      if (moduleResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = moduleResult.rows[0];

      if (module.owner_user_id !== user.sub) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (module.type !== 'remix') {
        return reply.status(400).send({ error: 'Module is not a remix module' });
      }

      const agentWallet = await getAgentWallet(id);
      if (!agentWallet) {
        return reply.status(404).send({ error: 'Agent wallet not found' });
      }

      return reply.send({
        moduleId: id,
        walletAddress: agentWallet.walletAddress,
        keyVersion: agentWallet.keyVersion,
        createdAt: agentWallet.createdAt,
        fundingInstructions: `Fund this wallet with testnet tokens to enable remix payments. Address: ${agentWallet.walletAddress}`,
      });
    }
  );

  // ==================== EVAL ENDPOINTS ====================

  const AddEvalCasesSchema = z.object({
    cases: z
      .array(
        z.object({
          prompt: z.string().min(1).max(1000),
          rubric: z.string().max(2000).optional(),
          expectedKeywords: z.array(z.string().max(100)).max(20).optional(),
        })
      )
      .min(1)
      .max(50),
  });

  // Add eval cases to module
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof AddEvalCasesSchema> }>(
    '/api/seller/modules/:id/eval/cases',
    { preValidation: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof AddEvalCasesSchema> }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      // Verify ownership
      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const parseResult = AddEvalCasesSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      try {
        const added = await addEvalCases(id, parseResult.data.cases);
        return reply.status(201).send({
          message: `Successfully added ${added.length} eval cases`,
          count: added.length,
          cases: added,
        });
      } catch (err) {
        fastify.log.error(err, 'Failed to add eval cases');
        return reply.status(500).send({ error: 'Failed to add eval cases' });
      }
    }
  );

  // Get eval cases for module
  fastify.get<{ Params: { id: string } }>(
    '/api/seller/modules/:id/eval/cases',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const cases = await getEvalCases(id);
      return reply.send({ count: cases.length, cases });
    }
  );

  // Delete all eval cases for module
  fastify.delete<{ Params: { id: string } }>(
    '/api/seller/modules/:id/eval/cases',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const deleted = await deleteEvalCases(id);
      return reply.send({ message: `Deleted ${deleted} eval cases`, count: deleted });
    }
  );

  // Run eval for module
  fastify.post<{ Params: { id: string } }>(
    '/api/seller/modules/:id/eval/run',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      try {
        const result = await runEval(id);
        return reply.send({
          message: `Eval completed with score ${result.score}/10`,
          ...result,
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('No eval cases')) {
          return reply.status(400).send({ error: err.message });
        }
        fastify.log.error(err, 'Failed to run eval');
        return reply.status(500).send({ error: 'Failed to run eval' });
      }
    }
  );

  // Get latest eval result for module
  fastify.get<{ Params: { id: string } }>(
    '/api/seller/modules/:id/eval',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const latestRun = await getLatestEvalRun(id);
      if (!latestRun) {
        return reply.send({ hasRun: false, message: 'No eval runs yet' });
      }

      return reply.send({ hasRun: true, ...latestRun });
    }
  );

  // Get eval run history for module
  fastify.get<{ Params: { id: string } }>(
    '/api/seller/modules/:id/eval/history',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = request.user as { sub: string; address: string; role: string };

      if (!(await verifyModuleOwnership(id, user.sub))) {
        return reply.status(403).send({ error: 'Access denied or module not found' });
      }

      const runs = await getEvalRuns(id);
      return reply.send({ count: runs.length, runs });
    }
  );
}
