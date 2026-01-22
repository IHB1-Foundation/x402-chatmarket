import { getPool } from './db.js';
import { seed } from '../cli/seed.js';

export type DemoSeedResult =
  | { attempted: false; seeded: false; reason: string }
  | { attempted: true; seeded: boolean; reason: string };

export async function ensureDemoSeed(): Promise<DemoSeedResult> {
  const enabled = process.env.AUTO_SEED === 'true';
  if (!enabled) {
    return { attempted: false, seeded: false, reason: 'AUTO_SEED not enabled' };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1::int, $2::int)', [402, 1]);

    const modulesTable = await client.query<{ regclass: string | null }>(
      'SELECT to_regclass($1) as regclass',
      ['public.modules']
    );

    if (!modulesTable.rows[0]?.regclass) {
      return { attempted: true, seeded: false, reason: 'modules table missing' };
    }

    const alreadyHasPublished = await client.query(
      "SELECT 1 FROM modules WHERE status = 'published' LIMIT 1"
    );
    if (alreadyHasPublished.rowCount && alreadyHasPublished.rowCount > 0) {
      return { attempted: false, seeded: false, reason: 'published modules already exist' };
    }

    console.log('No published modules found: seeding demo data...');
    await seed({ closePool: false });
    return { attempted: true, seeded: true, reason: 'seeded demo modules' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`WARN: Demo seeding failed: ${msg}`);
    return { attempted: true, seeded: false, reason: `seed failed: ${msg}` };
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1::int, $2::int)', [402, 1]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`WARN: Failed to release demo seed lock: ${msg}`);
    }
    client.release();
  }
}

