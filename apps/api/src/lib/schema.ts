import fs from 'node:fs/promises';
import path from 'node:path';
import { getPool } from './db.js';

type EnsureSchemaMethod = 'already' | 'init-db.sql' | 'fallback';

async function readInitSql(): Promise<string | null> {
  const candidates = [
    // Typical Railway rootDir=apps/api
    path.resolve(process.cwd(), '../../infra/init-db.sql'),
    // If running from repo root
    path.resolve(process.cwd(), 'infra/init-db.sql'),
    // If cwd is dist/
    path.resolve(process.cwd(), '../../../infra/init-db.sql'),
  ];

  for (const filePath of candidates) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`WARN: Failed to read DB init SQL at ${filePath}: ${msg}`);
    }
  }

  return null;
}

async function tableExists(tableName: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ regclass: string | null }>(
    'SELECT to_regclass($1) as regclass',
    [`public.${tableName}`]
  );
  return Boolean(result.rows[0]?.regclass);
}

async function detectUuidDefaultFn(): Promise<'uuid_generate_v4()' | 'gen_random_uuid()'> {
  const pool = getPool();

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    return 'uuid_generate_v4()';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`WARN: Failed to enable uuid-ossp extension: ${msg}`);
  }

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    return 'gen_random_uuid()';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`WARN: Failed to enable pgcrypto extension: ${msg}`);
  }

  throw new Error(
    'Database is missing a UUID generator extension. ' +
      'Enable either uuid-ossp (uuid_generate_v4) or pgcrypto (gen_random_uuid).'
  );
}

async function runFallbackSchema(): Promise<void> {
  const pool = getPool();
  const uuidDefaultFn = await detectUuidDefaultFn();

  const statements: string[] = [
    // Enum types (idempotent)
    `DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE module_type AS ENUM ('base', 'remix');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE module_status AS ENUM ('draft', 'published', 'blocked');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE pricing_mode AS ENUM ('per_message', 'per_session');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE payment_event AS ENUM ('settled', 'failed');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE chat_message_role AS ENUM ('system', 'user', 'assistant');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE document_source_type AS ENUM ('qa', 'doc');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,

    // Tables (idempotent)
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      wallet_address TEXT NOT NULL UNIQUE,
      role user_role NOT NULL DEFAULT 'buyer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);`,

    `CREATE TABLE IF NOT EXISTS modules (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type module_type NOT NULL DEFAULT 'base',
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags TEXT[] NOT NULL DEFAULT '{}',
      status module_status NOT NULL DEFAULT 'draft',
      persona_prompt TEXT NOT NULL DEFAULT '',
      pricing_mode pricing_mode NOT NULL DEFAULT 'per_message',
      price_amount TEXT NOT NULL DEFAULT '10000',
      session_policy JSONB,
      pay_to TEXT NOT NULL,
      network TEXT NOT NULL,
      asset_contract TEXT NOT NULL,
      upstream_module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
      remix_policy JSONB,
      eval_score INTEGER,
      last_eval_at TIMESTAMPTZ,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_modules_owner ON modules(owner_user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_modules_featured ON modules(featured) WHERE featured = TRUE;`,
    `CREATE INDEX IF NOT EXISTS idx_modules_status ON modules(status);`,
    `CREATE INDEX IF NOT EXISTS idx_modules_type ON modules(type);`,
    `CREATE INDEX IF NOT EXISTS idx_modules_upstream ON modules(upstream_module_id);`,

    // NOTE: Fallback uses TEXT embedding to avoid pgvector dependency.
    `CREATE TABLE IF NOT EXISTS module_documents (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      source_type document_source_type NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_module_documents_module ON module_documents(module_id);`,

    `CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
      payer_wallet TEXT NOT NULL,
      pay_to TEXT NOT NULL,
      value TEXT NOT NULL,
      tx_hash TEXT,
      network TEXT NOT NULL,
      event payment_event NOT NULL,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_payments_module ON payments(module_id);`,
    `CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_wallet);`,
    `CREATE INDEX IF NOT EXISTS idx_payments_tx_hash ON payments(tx_hash);`,
    `CREATE INDEX IF NOT EXISTS idx_payments_event ON payments(event);`,

    `CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      wallet_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_chats_module ON chats(module_id);`,
    `CREATE INDEX IF NOT EXISTS idx_chats_wallet ON chats(wallet_address);`,

    `CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role chat_message_role NOT NULL,
      content TEXT NOT NULL,
      token_usage JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);`,

    `CREATE TABLE IF NOT EXISTS agent_wallets (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      module_id UUID NOT NULL UNIQUE REFERENCES modules(id) ON DELETE CASCADE,
      wallet_address TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      key_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_agent_wallets_module ON agent_wallets(module_id);`,

    `CREATE TABLE IF NOT EXISTS eval_cases (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      rubric TEXT,
      expected_keywords TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_eval_cases_module ON eval_cases(module_id);`,

    `CREATE TABLE IF NOT EXISTS eval_runs (
      id UUID PRIMARY KEY DEFAULT ${uuidDefaultFn},
      module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_eval_runs_module ON eval_runs(module_id);`,

    // updated_at triggers (idempotent)
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
     END;
     $$ language 'plpgsql';`,
    `DROP TRIGGER IF EXISTS update_users_updated_at ON users;`,
    `CREATE TRIGGER update_users_updated_at
       BEFORE UPDATE ON users
       FOR EACH ROW
       EXECUTE FUNCTION update_updated_at_column();`,
    `DROP TRIGGER IF EXISTS update_modules_updated_at ON modules;`,
    `CREATE TRIGGER update_modules_updated_at
       BEFORE UPDATE ON modules
       FOR EACH ROW
       EXECUTE FUNCTION update_updated_at_column();`,
  ];

  for (const sql of statements) {
    await pool.query(sql);
  }
}

type EnsureSchemaResult =
  | { method: Exclude<EnsureSchemaMethod, 'error' | 'pending'> }
  | { method: 'pending' }
  | { method: 'error'; error: string };

export async function ensureDbSchema(): Promise<EnsureSchemaResult> {
  try {
    if (await tableExists('modules')) return { method: 'already' };

    const pool = getPool();

    const initSql = await readInitSql();
    if (initSql) {
      try {
        console.log('DB schema missing: running infra/init-db.sql (best-effort).');
        await pool.query(initSql);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`WARN: infra/init-db.sql failed: ${msg}`);
      }

      if (await tableExists('modules')) return { method: 'init-db.sql' };
    }

    console.log('DB schema missing: applying fallback schema (no pgvector).');
    await runFallbackSchema();

    if (!(await tableExists('modules'))) {
      return { method: 'error', error: 'DB schema initialization failed: modules table still missing.' };
    }

    return { method: 'fallback' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`WARN: DB schema initialization error: ${msg}`);
    return { method: 'error', error: msg };
  }
}
