import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../config.js';
import { getPool } from '../lib/db.js';
import { deleteModuleDocuments, ingestDocuments, ingestQAPairs } from '../services/knowledge.js';
import { fileURLToPath } from 'node:url';

async function loadEnvFile(filePath: string): Promise<void> {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    // Ignore missing file (supports Railway where env is provided via vars)
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'ENOENT'
    ) {
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`WARN: Failed to load env file at ${filePath}: ${msg}`);
  }
}

async function upsertUser(walletAddress: string): Promise<string> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO users (wallet_address, role)
     VALUES ($1, 'seller')
     ON CONFLICT (wallet_address) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [walletAddress.toLowerCase()]
  );
  return result.rows[0].id;
}

async function upsertModule(params: {
  ownerUserId: string;
  type?: 'base' | 'remix';
  name: string;
  description: string;
  tags: string[];
  personaPrompt: string;
  pricingMode: 'per_message' | 'per_session';
  priceAmount: string;
  sessionPolicy?: { minutes: number; messageCredits: number } | null;
  payTo: string;
  network: string;
  assetContract: string;
  featured?: boolean;
}): Promise<string> {
  const pool = getPool();
  const {
    ownerUserId,
    type = 'base',
    name,
    description,
    tags,
    personaPrompt,
    pricingMode,
    priceAmount,
    sessionPolicy = null,
    payTo,
    network,
    assetContract,
    featured = false,
  } = params;
  const sessionPolicyValue = sessionPolicy ? JSON.stringify(sessionPolicy) : null;

  const existing = await pool.query(
    `SELECT id FROM modules WHERE owner_user_id = $1 AND name = $2 LIMIT 1`,
    [ownerUserId, name]
  );

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id as string;
    await pool.query(
      `UPDATE modules
       SET type = $2,
           description = $3,
           tags = $4,
           status = 'published',
           persona_prompt = $5,
           pricing_mode = $6,
           price_amount = $7,
           session_policy = $8::jsonb,
           pay_to = $9,
           network = $10,
           asset_contract = $11,
           featured = $12,
           updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        type,
        description,
        tags,
        personaPrompt,
        pricingMode,
        priceAmount,
        sessionPolicyValue,
        payTo,
        network,
        assetContract,
        featured,
      ]
    );
    return id;
  }

  const inserted = await pool.query(
    `INSERT INTO modules (
       owner_user_id, type, name, description, tags, status,
       persona_prompt, pricing_mode, price_amount, session_policy,
       pay_to, network, asset_contract, featured
     )
     VALUES (
       $1, $2, $3, $4, $5, 'published',
       $6, $7, $8, $9::jsonb, $10, $11, $12, $13
     )
     RETURNING id`,
    [
      ownerUserId,
      type,
      name,
      description,
      tags,
      personaPrompt,
      pricingMode,
      priceAmount,
      sessionPolicyValue,
      payTo,
      network,
      assetContract,
      featured,
    ]
  );

  return inserted.rows[0].id as string;
}

async function setEvalScore(moduleId: string, score: number): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE modules SET eval_score = $1, last_eval_at = NOW() WHERE id = $2`,
    [score, moduleId]
  );
}

async function createRemixModule(params: {
  ownerUserId: string;
  name: string;
  description: string;
  tags: string[];
  deltaPersonaPrompt: string;
  pricingMode: 'per_message' | 'per_session';
  priceAmount: string;
  sessionPolicy?: { minutes: number; messageCredits: number } | null;
  payTo: string;
  network: string;
  assetContract: string;
  upstreamModuleId: string;
  remixPolicy: { upstreamWeight: number; appendMode: string };
}): Promise<string> {
  const pool = getPool();
  const {
    ownerUserId,
    name,
    description,
    tags,
    deltaPersonaPrompt,
    pricingMode,
    priceAmount,
    sessionPolicy = null,
    payTo,
    network,
    assetContract,
    upstreamModuleId,
    remixPolicy,
  } = params;

  // Get upstream info
  const upstreamResult = await pool.query(
    `SELECT pay_to, price_amount FROM modules WHERE id = $1`,
    [upstreamModuleId]
  );
  const upstream = upstreamResult.rows[0];

  const fullRemixPolicy = JSON.stringify({
    ...remixPolicy,
    upstreamModuleId,
    upstreamPayTo: upstream.pay_to,
    upstreamPriceAmount: upstream.price_amount,
  });
  const sessionPolicyValue = sessionPolicy ? JSON.stringify(sessionPolicy) : null;

  // Check existing
  const existing = await pool.query(
    `SELECT id FROM modules WHERE owner_user_id = $1 AND name = $2 AND type = 'remix' LIMIT 1`,
    [ownerUserId, name]
  );

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id as string;
    await pool.query(
      `UPDATE modules
       SET description = $2,
           tags = $3,
           status = 'published',
           persona_prompt = $4,
           pricing_mode = $5,
           price_amount = $6,
           session_policy = $7::jsonb,
           pay_to = $8,
           network = $9,
           asset_contract = $10,
           upstream_module_id = $11,
           remix_policy = $12::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        description,
        tags,
        deltaPersonaPrompt,
        pricingMode,
        priceAmount,
        sessionPolicyValue,
        payTo,
        network,
        assetContract,
        upstreamModuleId,
        fullRemixPolicy,
      ]
    );
    return id;
  }

  const inserted = await pool.query(
    `INSERT INTO modules (
       owner_user_id, type, name, description, tags, status,
       persona_prompt, pricing_mode, price_amount, session_policy,
       pay_to, network, asset_contract, upstream_module_id, remix_policy
     )
     VALUES (
       $1, 'remix', $2, $3, $4, 'published',
       $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13::jsonb
     )
     RETURNING id`,
    [
      ownerUserId,
      name,
      description,
      tags,
      deltaPersonaPrompt,
      pricingMode,
      priceAmount,
      sessionPolicyValue,
      payTo,
      network,
      assetContract,
      upstreamModuleId,
      fullRemixPolicy,
    ]
  );

  return inserted.rows[0].id as string;
}

export async function seed(options: { closePool?: boolean } = {}): Promise<void> {
  await loadEnvFile(path.resolve(process.cwd(), '.env'));
  await loadEnvFile(path.resolve(process.cwd(), '.env.railway'));

  const config = getConfig();
  const pool = getPool();

  const seedWallet =
    (process.env.SEED_WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f8bBf5').toLowerCase();
  const network = config.X402_NETWORK || 'cronos-testnet';
  const assetContract =
    config.X402_ASSET_CONTRACT || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0';

  console.log('Starting seed...');
  console.log(`Network: ${network}`);
  console.log(`Asset contract: ${assetContract}`);
  console.log(`Seed wallet: ${seedWallet}`);

  const ownerUserId = await upsertUser(seedWallet);
  console.log(`User ID: ${ownerUserId}`);

  // ==================== BASE MODULES ====================

  const demoModuleId = await upsertModule({
    ownerUserId,
    name: 'Local Demo Module',
    description: 'Seeded module for local development and UI testing.',
    tags: ['demo', 'seed', 'local'],
    personaPrompt:
      'You are a helpful AI assistant specialized in concise, practical answers for local development.',
    pricingMode: 'per_message',
    priceAmount: '10000',
    sessionPolicy: null,
    payTo: seedWallet,
    network,
    assetContract,
    featured: true,
  });

  const ragModuleId = await upsertModule({
    ownerUserId,
    name: 'RPG Merchant NPC',
    description: 'A wise merchant who sells magical items and shares tales from distant lands.',
    tags: ['rpg', 'npc', 'fantasy', 'gaming'],
    personaPrompt:
      'You are Grimwald the Merchant, a seasoned trader who has traveled across many realms. ' +
      'You speak with wisdom and occasional mystery. You know about magical items, potions, and rare artifacts.',
    pricingMode: 'per_message',
    priceAmount: '10000',
    sessionPolicy: null,
    payTo: seedWallet,
    network,
    assetContract,
    featured: true,
  });

  const coachModuleId = await upsertModule({
    ownerUserId,
    name: 'PRD Coach',
    description: 'Product requirements coach for crisp, testable specs.',
    tags: ['product', 'pm', 'spec', 'business'],
    personaPrompt:
      'You are a product requirements coach. You ask clarifying questions, propose crisp acceptance criteria, ' +
      'and keep scope focused.',
    pricingMode: 'per_message',
    priceAmount: '15000',
    sessionPolicy: null,
    payTo: seedWallet,
    network,
    assetContract,
  });

  const sessionModuleId = await upsertModule({
    ownerUserId,
    name: 'On-Call Helper (Session Pass)',
    description: 'Incident response helper sold per session with message credits.',
    tags: ['devops', 'incident', 'session', 'engineering'],
    personaPrompt:
      'You are an on-call incident response assistant. Provide concise troubleshooting steps, ' +
      'and ask for the minimum data needed to triage quickly.',
    pricingMode: 'per_session',
    priceAmount: '50000',
    sessionPolicy: { minutes: 30, messageCredits: 8 },
    payTo: seedWallet,
    network,
    assetContract,
  });

  // Additional modules for demo variety
  const codeReviewerId = await upsertModule({
    ownerUserId,
    name: 'Code Reviewer',
    description: 'Senior engineer persona that reviews code for bugs, security issues, and best practices.',
    tags: ['engineering', 'code', 'review', 'security'],
    personaPrompt:
      'You are a senior software engineer conducting code reviews. Focus on security vulnerabilities, ' +
      'performance issues, and maintainability. Be constructive and educational.',
    pricingMode: 'per_message',
    priceAmount: '20000',
    sessionPolicy: null,
    payTo: seedWallet,
    network,
    assetContract,
  });

  const fitnessCoachId = await upsertModule({
    ownerUserId,
    name: 'Fitness Coach',
    description: 'Personal trainer that creates workout plans and nutrition advice.',
    tags: ['fitness', 'health', 'lifestyle', 'coaching'],
    personaPrompt:
      'You are a certified personal trainer and nutritionist. Create personalized workout plans, ' +
      'provide form tips, and suggest nutrition strategies. Always emphasize safety and sustainable habits.',
    pricingMode: 'per_session',
    priceAmount: '30000',
    sessionPolicy: { minutes: 60, messageCredits: 15 },
    payTo: seedWallet,
    network,
    assetContract,
  });

  const writingAssistantId = await upsertModule({
    ownerUserId,
    name: 'Writing Assistant',
    description: 'Professional editor that helps improve clarity, tone, and structure of your writing.',
    tags: ['writing', 'editing', 'content', 'communication'],
    personaPrompt:
      'You are a professional editor with experience in technical writing, marketing copy, and creative content. ' +
      'Help users improve their writing by focusing on clarity, conciseness, and impact.',
    pricingMode: 'per_message',
    priceAmount: '12000',
    sessionPolicy: null,
    payTo: seedWallet,
    network,
    assetContract,
  });

  const sqlExpertId = await upsertModule({
    ownerUserId,
    name: 'SQL Query Expert',
    description: 'Database expert that helps write and optimize SQL queries.',
    tags: ['database', 'sql', 'engineering', 'data'],
    personaPrompt:
      'You are a database expert specializing in SQL optimization. Help users write efficient queries, ' +
      'understand execution plans, and design schemas. Support PostgreSQL, MySQL, and SQLite syntax.',
    pricingMode: 'per_message',
    priceAmount: '18000',
    sessionPolicy: null,
    payTo: seedWallet,
    network,
    assetContract,
  });

  // ==================== REMIX MODULE ====================

  const remixModuleId = await createRemixModule({
    ownerUserId,
    name: 'Scammy Merchant (Remix)',
    description: 'A suspicious merchant who offers deals that seem too good to be true.',
    tags: ['rpg', 'npc', 'fantasy', 'gaming', 'remix'],
    deltaPersonaPrompt:
      'You are now a VERY shady version of Grimwald. You offer suspiciously cheap items, ' +
      'speak in a hushed tone, and occasionally hint that items might be stolen or cursed. ' +
      'Add humor by being over-the-top suspicious.',
    pricingMode: 'per_message',
    priceAmount: '15000',
    sessionPolicy: null,
    payTo: seedWallet,
    network,
    assetContract,
    upstreamModuleId: ragModuleId,
    remixPolicy: { upstreamWeight: 0.6, appendMode: 'after' },
  });

  // ==================== SET EVAL SCORES ====================

  await setEvalScore(demoModuleId, 8);
  await setEvalScore(ragModuleId, 9);
  await setEvalScore(coachModuleId, 7);
  await setEvalScore(sessionModuleId, 8);
  await setEvalScore(codeReviewerId, 9);
  await setEvalScore(fitnessCoachId, 7);
  await setEvalScore(writingAssistantId, 8);
  await setEvalScore(sqlExpertId, 9);
  await setEvalScore(remixModuleId, 6);

  console.log('Modules created with eval scores');

  const skipEmbeddings = process.env.SEED_SKIP_EMBEDDINGS === 'true';
  if (skipEmbeddings) {
    console.log('INFO: SEED_SKIP_EMBEDDINGS=true: skipping QA/doc ingestion.');
  } else {
    // Rebuild RAG docs for idempotent runs
    await deleteModuleDocuments(ragModuleId);
    await deleteModuleDocuments(coachModuleId);
    await deleteModuleDocuments(sessionModuleId);
    await deleteModuleDocuments(codeReviewerId);
    await deleteModuleDocuments(fitnessCoachId);
    await deleteModuleDocuments(writingAssistantId);
    await deleteModuleDocuments(sqlExpertId);

    await ingestQAPairs(ragModuleId, [
      {
        question: 'What items do you have for sale?',
        answer:
          'Ah, a customer! I have healing potions for 10 gold, enchanted daggers for 50 gold, ' +
          'and a mysterious amulet that grants night vision - only 200 gold!',
      },
      {
        question: 'Tell me about yourself',
        answer:
          'I am Grimwald, merchant of the Azure Crossroads. I have traded in kingdoms you have never heard of ' +
          'and seen wonders that would make your head spin.',
      },
    ]);

    await ingestDocuments(ragModuleId, [
      {
        title: "Grimwald's Inventory",
        content:
          'Healing Potion: Restores vitality and cures minor ailments.\n\n' +
          'Enchanted Dagger: A balanced blade that glows faintly near danger.\n\n' +
          'Amulet of Night Vision: Allows the wearer to see in total darkness.',
      },
      {
        title: 'Merchant Notes',
        content:
          'Grimwald prices items based on rarity and risk. He values honesty and rewards polite customers ' +
          'with small discounts or extra lore.',
      },
    ]);

    await ingestQAPairs(coachModuleId, [
      {
        question: 'What makes a good PRD?',
        answer:
          'Clear problem statement, target users, measurable success metrics, non-goals, ' +
          'and a testable scope with acceptance criteria.',
      },
      {
        question: 'How do I write acceptance criteria?',
        answer:
          'Use Given/When/Then style. Make them observable and non-ambiguous. Avoid implementation details.',
      },
    ]);

    await ingestDocuments(coachModuleId, [
      {
        title: 'PRD Checklist',
        content:
          '1) Problem & why now\n2) Goals & success metrics\n3) Non-goals\n4) UX outline\n5) ' +
          'Edge cases\n6) Dependencies\n7) Rollout & monitoring',
      },
      {
        title: 'Acceptance Criteria Examples',
        content:
          'Given a signed-in user, when they upload a PDF under 10MB, then processing starts within 5 seconds.',
      },
    ]);

    await ingestQAPairs(sessionModuleId, [
      {
        question: 'What should I collect during incident triage?',
        answer:
          'Impact scope, start time, recent deploys, error rates, and key logs/metrics. Start with the fastest ' +
          'signal and identify blast radius.',
      },
      {
        question: 'How do I decide if I should rollback?',
        answer:
          'Rollback if a recent change correlates with a major impact and mitigation is slower than revert. ' +
          'Communicate the decision and timeline clearly.',
      },
    ]);

    await ingestDocuments(sessionModuleId, [
      {
        title: 'Incident Triage Flow',
        content:
          '1) Detect and declare\n2) Stabilize user impact\n3) Triage likely causes\n4) Mitigate or rollback\n' +
          '5) Verify recovery\n6) Post-incident review',
      },
      {
        title: 'Common Signals',
        content:
          'Error rate spikes, latency regressions, dependency timeouts, saturation metrics, ' +
          'and user reports from support.',
      },
    ]);

    // Code Reviewer knowledge
    await ingestQAPairs(codeReviewerId, [
      {
        question: 'What should I look for in a code review?',
        answer:
          'Focus on: 1) Security vulnerabilities (injection, XSS), 2) Performance issues, ' +
          '3) Error handling, 4) Code readability, 5) Test coverage, 6) Adherence to team conventions.',
      },
      {
        question: 'How do I give constructive feedback?',
        answer:
          'Be specific, explain the "why", suggest alternatives, praise good patterns, ' +
          'and focus on the code not the person. Use questions to prompt thinking.',
      },
    ]);

    // Fitness Coach knowledge
    await ingestQAPairs(fitnessCoachId, [
      {
        question: 'How often should I work out?',
        answer:
          'For general fitness: 3-4 days/week with rest days between intense sessions. ' +
          'Beginners start with 2-3 days. Listen to your body and prioritize recovery.',
      },
      {
        question: 'What should I eat before a workout?',
        answer:
          'A light meal 1-2 hours before: complex carbs + lean protein. ' +
          'Examples: oatmeal with banana, whole grain toast with peanut butter, or Greek yogurt with fruit.',
      },
    ]);

    // Writing Assistant knowledge
    await ingestQAPairs(writingAssistantId, [
      {
        question: 'How do I improve my writing?',
        answer:
          'Key principles: 1) Write with the reader in mind, 2) Use active voice, ' +
          '3) Cut unnecessary words, 4) Vary sentence length, 5) Read your work aloud.',
      },
      {
        question: 'How do I structure a blog post?',
        answer:
          'Hook (opening), Context (why it matters), Main points (3-5 with examples), ' +
          'Call-to-action or takeaway, Strong closing. Use headers for scanability.',
      },
    ]);

    // SQL Expert knowledge
    await ingestQAPairs(sqlExpertId, [
      {
        question: 'How do I optimize a slow query?',
        answer:
          '1) Check EXPLAIN/EXPLAIN ANALYZE, 2) Add indexes on WHERE/JOIN columns, ' +
          '3) Avoid SELECT *, 4) Use LIMIT for pagination, 5) Consider query restructuring.',
      },
      {
        question: 'When should I use a JOIN vs a subquery?',
        answer:
          'JOINs are usually faster and more readable for combining tables. ' +
          'Use subqueries for complex filtering, EXISTS checks, or when you need a derived value.',
      },
    ]);

    console.log('Knowledge docs ingested for all modules');
  }

  console.log('\n=== Seed Complete ===');
  console.log('Base Modules:');
  console.log(`  - Local Demo Module: ${demoModuleId} (featured)`);
  console.log(`  - RPG Merchant NPC: ${ragModuleId} (featured)`);
  console.log(`  - PRD Coach: ${coachModuleId}`);
  console.log(`  - On-Call Helper: ${sessionModuleId}`);
  console.log(`  - Code Reviewer: ${codeReviewerId}`);
  console.log(`  - Fitness Coach: ${fitnessCoachId}`);
  console.log(`  - Writing Assistant: ${writingAssistantId}`);
  console.log(`  - SQL Query Expert: ${sqlExpertId}`);
  console.log('Remix Modules:');
  console.log(`  - Scammy Merchant: ${remixModuleId} (remix of RPG Merchant)`);
  console.log(`\nSeed wallet: ${seedWallet}`);
  console.log('All modules have eval scores assigned.');
  console.log('\nTo view the marketplace, visit: http://localhost:3000/marketplace');

  const closePool = options.closePool ?? true;
  if (closePool) {
    await pool.end();
  }
}

const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  return currentFile === path.resolve(process.argv[1]);
})();

if (isDirectRun) {
  seed().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Seed failed: ${msg}`);
    process.exit(1);
  });
}
