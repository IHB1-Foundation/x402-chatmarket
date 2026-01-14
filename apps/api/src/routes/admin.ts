import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPool } from '../lib/db.js';

// Helper to verify admin role
function isAdmin(user: { sub: string; address: string; role: string }): boolean {
  return user.role === 'admin';
}

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // Middleware to check admin role
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    const user = request.user as { sub: string; address: string; role: string };
    if (!isAdmin(user)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }
  };

  // List all modules (admin view - includes all statuses)
  fastify.get(
    '/api/admin/modules',
    { preValidation: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const pool = getPool();

      const result = await pool.query(`
        SELECT m.id, m.type, m.name, m.description, m.tags, m.status, m.featured,
               m.pricing_mode, m.price_amount, m.pay_to, m.network, m.asset_contract,
               m.eval_score, m.created_at, m.updated_at,
               u.wallet_address as owner_address
        FROM modules m
        JOIN users u ON m.owner_user_id = u.id
        ORDER BY m.created_at DESC
      `);

      const modules = result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        description: row.description,
        tags: row.tags,
        status: row.status,
        featured: row.featured,
        pricingMode: row.pricing_mode,
        priceAmount: row.price_amount,
        payTo: row.pay_to,
        network: row.network,
        assetContract: row.asset_contract,
        evalScore: row.eval_score,
        ownerAddress: row.owner_address,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return reply.send({ modules, count: modules.length });
    }
  );

  // Block a module
  fastify.post<{ Params: { id: string } }>(
    '/api/admin/modules/:id/block',
    { preValidation: [requireAdmin] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const pool = getPool();

      // Check module exists
      const moduleResult = await pool.query(
        'SELECT id, name, status FROM modules WHERE id = $1',
        [id]
      );

      if (moduleResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = moduleResult.rows[0];

      if (module.status === 'blocked') {
        return reply.status(400).send({ error: 'Module is already blocked' });
      }

      // Block the module
      const result = await pool.query(
        `UPDATE modules SET status = 'blocked', updated_at = NOW()
         WHERE id = $1
         RETURNING id, status, updated_at`,
        [id]
      );

      return reply.send({
        id: result.rows[0].id,
        status: result.rows[0].status,
        message: `Module "${module.name}" has been blocked`,
        updatedAt: result.rows[0].updated_at,
      });
    }
  );

  // Unblock a module (return to draft status)
  fastify.post<{ Params: { id: string } }>(
    '/api/admin/modules/:id/unblock',
    { preValidation: [requireAdmin] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const pool = getPool();

      // Check module exists
      const moduleResult = await pool.query(
        'SELECT id, name, status FROM modules WHERE id = $1',
        [id]
      );

      if (moduleResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = moduleResult.rows[0];

      if (module.status !== 'blocked') {
        return reply.status(400).send({ error: 'Module is not blocked' });
      }

      // Unblock the module (set to draft)
      const result = await pool.query(
        `UPDATE modules SET status = 'draft', updated_at = NOW()
         WHERE id = $1
         RETURNING id, status, updated_at`,
        [id]
      );

      return reply.send({
        id: result.rows[0].id,
        status: result.rows[0].status,
        message: `Module "${module.name}" has been unblocked (set to draft)`,
        updatedAt: result.rows[0].updated_at,
      });
    }
  );

  // Feature a module
  fastify.post<{ Params: { id: string } }>(
    '/api/admin/modules/:id/feature',
    { preValidation: [requireAdmin] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const pool = getPool();

      // Check module exists
      const moduleResult = await pool.query(
        'SELECT id, name, status, featured FROM modules WHERE id = $1',
        [id]
      );

      if (moduleResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = moduleResult.rows[0];

      if (module.status !== 'published') {
        return reply.status(400).send({
          error: 'Only published modules can be featured',
        });
      }

      if (module.featured) {
        return reply.status(400).send({ error: 'Module is already featured' });
      }

      // Feature the module
      const result = await pool.query(
        `UPDATE modules SET featured = TRUE, updated_at = NOW()
         WHERE id = $1
         RETURNING id, featured, updated_at`,
        [id]
      );

      return reply.send({
        id: result.rows[0].id,
        featured: result.rows[0].featured,
        message: `Module "${module.name}" has been featured`,
        updatedAt: result.rows[0].updated_at,
      });
    }
  );

  // Unfeature a module
  fastify.post<{ Params: { id: string } }>(
    '/api/admin/modules/:id/unfeature',
    { preValidation: [requireAdmin] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const pool = getPool();

      // Check module exists
      const moduleResult = await pool.query(
        'SELECT id, name, featured FROM modules WHERE id = $1',
        [id]
      );

      if (moduleResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module = moduleResult.rows[0];

      if (!module.featured) {
        return reply.status(400).send({ error: 'Module is not featured' });
      }

      // Unfeature the module
      const result = await pool.query(
        `UPDATE modules SET featured = FALSE, updated_at = NOW()
         WHERE id = $1
         RETURNING id, featured, updated_at`,
        [id]
      );

      return reply.send({
        id: result.rows[0].id,
        featured: result.rows[0].featured,
        message: `Module "${module.name}" has been unfeatured`,
        updatedAt: result.rows[0].updated_at,
      });
    }
  );

  // Promote a user to admin (useful for initial setup)
  const PromoteAdminSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  });

  fastify.post<{ Body: z.infer<typeof PromoteAdminSchema> }>(
    '/api/admin/users/promote',
    { preValidation: [requireAdmin] },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof PromoteAdminSchema> }>,
      reply: FastifyReply
    ) => {
      const parseResult = PromoteAdminSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const { walletAddress } = parseResult.data;
      const pool = getPool();

      // Check if user exists
      const userResult = await pool.query(
        'SELECT id, wallet_address, role FROM users WHERE wallet_address = $1',
        [walletAddress.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      if (user.role === 'admin') {
        return reply.status(400).send({ error: 'User is already an admin' });
      }

      // Promote to admin
      const result = await pool.query(
        `UPDATE users SET role = 'admin', updated_at = NOW()
         WHERE id = $1
         RETURNING id, wallet_address, role, updated_at`,
        [user.id]
      );

      return reply.send({
        id: result.rows[0].id,
        walletAddress: result.rows[0].wallet_address,
        role: result.rows[0].role,
        message: `User ${walletAddress} has been promoted to admin`,
        updatedAt: result.rows[0].updated_at,
      });
    }
  );

  // List all users (admin view)
  fastify.get(
    '/api/admin/users',
    { preValidation: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const pool = getPool();

      const result = await pool.query(`
        SELECT id, wallet_address, role, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
      `);

      const users = result.rows.map((row) => ({
        id: row.id,
        walletAddress: row.wallet_address,
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return reply.send({ users, count: users.length });
    }
  );
}
