import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPool } from '../lib/db.js';

const ListModulesQuerySchema = z.object({
  q: z.string().max(200).optional(),
  tag: z.string().max(50).optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'eval_score']).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

type ListModulesQuery = z.infer<typeof ListModulesQuerySchema>;

export async function modulesRoutes(fastify: FastifyInstance): Promise<void> {
  // List/search published modules (public marketplace)
  fastify.get<{ Querystring: ListModulesQuery }>(
    '/api/modules',
    async (request: FastifyRequest<{ Querystring: ListModulesQuery }>, reply: FastifyReply) => {
      const parseResult = ListModulesQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: parseResult.error.issues,
        });
      }

      const { q, tag, sort, page, size } = parseResult.data;
      const pool = getPool();
      const offset = (page - 1) * size;

      // Build query conditions
      const conditions: string[] = ["status = 'published'"];
      const params: (string | number)[] = [];
      let paramIndex = 1;

      // Full-text search on name and description
      if (q) {
        conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        params.push(`%${q}%`);
        paramIndex++;
      }

      // Tag filter
      if (tag) {
        conditions.push(`$${paramIndex} = ANY(tags)`);
        params.push(tag);
        paramIndex++;
      }

      // Sort order - featured modules always appear first
      let orderBy: string;
      switch (sort) {
        case 'oldest':
          orderBy = 'featured DESC, created_at ASC';
          break;
        case 'price_asc':
          orderBy = 'featured DESC, CAST(price_amount AS BIGINT) ASC';
          break;
        case 'price_desc':
          orderBy = 'featured DESC, CAST(price_amount AS BIGINT) DESC';
          break;
        case 'eval_score':
          orderBy = 'featured DESC, COALESCE(eval_score, 0) DESC, created_at DESC';
          break;
        case 'newest':
        default:
          orderBy = 'featured DESC, created_at DESC';
          break;
      }

      // Count total
      const countQuery = `SELECT COUNT(*) as total FROM modules WHERE ${conditions.join(' AND ')}`;
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total, 10);

      // Get modules
      const query = `
        SELECT id, type, name, description, tags, status, featured,
               pricing_mode, price_amount, pay_to, network, asset_contract,
               eval_score, created_at
        FROM modules
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(size, offset);

      const result = await pool.query(query, params);

      const modules = result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        description: row.description,
        tags: row.tags,
        featured: row.featured,
        pricingMode: row.pricing_mode,
        priceAmount: row.price_amount,
        network: row.network,
        assetContract: row.asset_contract,
        evalScore: row.eval_score,
        createdAt: row.created_at,
      }));

      return reply.send({
        modules,
        pagination: {
          page,
          size,
          total,
          totalPages: Math.ceil(total / size),
        },
      });
    }
  );

  // Get module detail (public)
  fastify.get<{ Params: { id: string } }>(
    '/api/modules/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const pool = getPool();

      const result = await pool.query(
        `SELECT m.id, m.type, m.name, m.description, m.tags, m.status, m.featured,
                m.pricing_mode, m.price_amount, m.session_policy,
                m.pay_to, m.network, m.asset_contract,
                m.upstream_module_id, m.eval_score, m.last_eval_at, m.created_at,
                u.wallet_address as owner_address
         FROM modules m
         JOIN users u ON m.owner_user_id = u.id
         WHERE m.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = result.rows[0];

      // Only show published modules to public
      if (module.status !== 'published') {
        return reply.status(404).send({ error: 'Module not found' });
      }

      // Get document count for knowledge info
      const docCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM module_documents WHERE module_id = $1',
        [id]
      );
      const documentCount = parseInt(docCountResult.rows[0].count, 10);

      // Get sample prompts from Q/A if available
      const samplePromptsResult = await pool.query(
        `SELECT title FROM module_documents
         WHERE module_id = $1 AND source_type = 'qa'
         ORDER BY created_at
         LIMIT 3`,
        [id]
      );
      const examplePrompts = samplePromptsResult.rows.map((r) => r.title);

      return reply.send({
        id: module.id,
        type: module.type,
        name: module.name,
        description: module.description,
        tags: module.tags,
        featured: module.featured,
        pricingMode: module.pricing_mode,
        priceAmount: module.price_amount,
        sessionPolicy: module.session_policy,
        payTo: module.pay_to,
        network: module.network,
        assetContract: module.asset_contract,
        ownerAddress: module.owner_address,
        upstreamModuleId: module.upstream_module_id,
        evalScore: module.eval_score,
        lastEvalAt: module.last_eval_at,
        documentCount,
        examplePrompts,
        createdAt: module.created_at,
      });
    }
  );

  // Get all unique tags (for filtering UI)
  fastify.get('/api/modules/tags', async (_, reply: FastifyReply) => {
    const pool = getPool();

    const result = await pool.query(`
      SELECT DISTINCT unnest(tags) as tag, COUNT(*) as count
      FROM modules
      WHERE status = 'published'
      GROUP BY tag
      ORDER BY count DESC, tag ASC
      LIMIT 50
    `);

    return reply.send({
      tags: result.rows.map((r) => ({
        tag: r.tag,
        count: parseInt(r.count, 10),
      })),
    });
  });
}
