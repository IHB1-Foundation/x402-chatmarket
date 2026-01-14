import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

export async function checkDbConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const p = getPool();
    const client = await p.connect();
    const result = await client.query('SELECT 1 as test');
    client.release();
    return { ok: result.rows[0]?.test === 1 };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error };
  }
}

export async function checkPgvector(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const p = getPool();
    const client = await p.connect();
    const result = await client.query(
      "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
    );
    client.release();
    if (result.rows.length === 0) {
      return { ok: false, error: 'pgvector extension not installed' };
    }
    return { ok: true, version: result.rows[0].extversion };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error };
  }
}
