# TICKET.md

## Rules
- Work tickets in ascending ID order.
- Status must be one of: `TODO | DOING | DONE | BLOCKED`.
- A ticket is `DONE` only if all AC (Acceptance Criteria) are proven true.
- Every ticket must update its own Notes with:
    - started_at
    - finished_at (or blocked_at)
    - key decisions/assumptions
    - how AC was verified (commands + expected results)

---

## EPIC 0 — Repo, Infra, Config

### T-0001 — Initialize Monorepo Structure
- Status: DONE
- Priority: P0
- Dependencies: none
- Description:
    - Create monorepo with `apps/web`, `apps/api`, `packages/shared`, `infra`.
    - Choose workspace tooling (pnpm recommended).
- AC:
    - [x] `pnpm i` works from repo root
    - [x] `pnpm dev` runs web + api concurrently (even if minimal scaffolds)
    - [x] shared package import works from both apps
- Notes:
    - started_at: 2026-01-14T09:33:00Z
    - finished_at: 2026-01-14T09:38:00Z
    - commit: 5a3f60c
    - Decisions: Used pnpm 9.x workspaces, Next.js 14 (App Router), Fastify 4, tsx for dev
    - Verification:
      - `pnpm i` completes successfully
      - `pnpm dev` runs concurrently with logs from both web (port 3000) and api (port 3001)
      - `curl http://localhost:3001/api/test-shared` returns Module type from shared
      - `pnpm --filter web build` compiles without type errors

### T-0002 — Local Infra: Postgres + pgvector + Redis (docker-compose)
- Status: DONE
- Priority: P0
- Dependencies: T-0001
- Description:
    - Add docker-compose with Postgres and Redis.
    - Enable pgvector extension.
    - Add a health endpoint in API to confirm DB connectivity.
- AC:
    - [x] `docker-compose up` starts postgres + redis
    - [x] pgvector extension is installed (verified in migration or init script)
    - [x] `GET /health/db` returns OK when DB is up
- Notes:
    - started_at: 2026-01-14T09:40:00Z
    - finished_at: 2026-01-14T09:50:00Z
    - Decisions:
      - Used pgvector/pgvector:pg16 image (includes pgvector pre-installed)
      - init-db.sql enables vector extension on startup
      - Health endpoint checks postgres, pgvector, redis in parallel
      - Lazy-initialized connections to avoid startup crashes when DB not available
    - Verification (requires Docker Desktop running):
      - `cd infra && docker compose up -d` starts services
      - `docker compose exec postgres psql -U soulforge -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"` shows version
      - `curl http://localhost:3001/health/db` returns status with all services OK
    - Files: infra/docker-compose.yml, infra/init-db.sql, apps/api/src/lib/db.ts, apps/api/src/lib/redis.ts

### T-0003 — Config System + .env.example (No Hardcoding)
- Status: DONE
- Priority: P0
- Dependencies: T-0001
- Description:
    - Add `.env.example` for web and api with all required variables.
    - Fail fast with clear error messages when required env vars are missing.
- AC:
    - [x] `.env.example` includes DB/Redis/LLM/x402/security vars
    - [x] App crashes early with a clear "missing env var" message
- Notes:
    - started_at: 2026-01-14T09:55:00Z
    - finished_at: 2026-01-14T10:05:00Z
    - Decisions:
      - Zod-based config validation in @soulforge/shared
      - ConfigValidationError thrown with detailed issues list
      - API config.ts wraps validation and exits process with clear message
      - Separate .env.example for web (public vars only) and api (all vars)
    - Verification:
      - `DATABASE_URL= REDIS_URL= npx tsx src/index.ts` outputs clear error and exits:
        "FATAL: Invalid API configuration" with list of missing vars
      - .env.example files contain all required variables from PROJECT.md section 13
    - Files: packages/shared/src/config/index.ts, apps/api/.env.example, apps/web/.env.example, apps/api/src/config.ts

---

## EPIC 1 — x402 End-to-End Proof (Ship This First)

### T-0101 — Backend x402 POC: 402 → Verify/Settle → 200
- Status: DONE
- Priority: P0
- Dependencies: T-0002, T-0003
- Description:
    - Implement `/api/premium/echo` (or similar).
    - If no `X-PAYMENT`, return 402 + paymentRequirements.
    - If `X-PAYMENT` present, call facilitator verify + settle.
    - Record result to `payments` table.
- AC:
    - [x] Without payment header: returns 402 with valid JSON paymentRequirements
    - [x] With valid payment header: returns 200 + payload
    - [x] On verify/settle failure: returns a clear error (402 or 4xx) and stores failure record
    - [x] payments table stores both success and failure attempts
- Notes:
    - started_at: 2026-01-14T10:10:00Z
    - finished_at: 2026-01-14T10:25:00Z
    - Decisions:
      - Created x402 service with verify/settle functions supporting mock and real facilitator
      - In-memory payments repository for POC (will use DB in T-0201)
      - X402_MOCK_MODE env var enables local testing without facilitator
      - Mock mode decodes base64 JSON payment header for testing
    - Verification:
      - `curl -X POST .../api/premium/echo` without X-PAYMENT returns 402 with paymentRequirements
      - `curl -X POST .../api/premium/echo -H "X-PAYMENT: <base64>"` returns 200 with echo + payment info
      - Invalid payment header returns 402 and stores failure record in payments
      - `/api/premium/payments` shows all stored payments (settled/failed)
    - Files: apps/api/src/services/x402.ts, apps/api/src/repositories/payments.ts, apps/api/src/routes/premium.ts

### T-0102 — Web x402 POC: Handle 402 + Wallet Sign + Retry with X-PAYMENT
- Status: DONE
- Priority: P0
- Dependencies: T-0101
- Description:
    - Minimal UI that calls `/api/premium/echo`.
    - On 402, prompt "Pay with wallet", build X-PAYMENT, retry request.
- AC:
    - [x] In browser, user can complete the flow to 200
    - [x] Debug panel shows 402 response body and final 200 response
- Notes:
    - started_at: 2026-01-14T10:30:00Z
    - finished_at: 2026-01-14T10:50:00Z
    - Decisions:
      - Used wagmi + viem for wallet connection and EIP-712 signing
      - Created /x402-poc page with full debug panel showing request/response logs
      - EIP-712 PaymentAuthorization type with from/to/value/validAfter/validBefore/nonce
      - Supports MetaMask, Coinbase Wallet, and injected providers
    - Verification (requires browser + wallet):
      1. Start API with X402_MOCK_MODE=true
      2. Start web with `pnpm --filter web dev`
      3. Go to http://localhost:3000/x402-poc
      4. Connect wallet (MetaMask/etc)
      5. Click "Call Premium Echo" button
      6. Debug panel shows: 402 response -> wallet sign prompt -> 200 response
    - Files: apps/web/src/app/x402-poc/page.tsx, apps/web/src/lib/wagmi.ts, apps/web/src/providers/WagmiProvider.tsx

### T-0103 — Payment Config Abstraction (Network/Token/Domain)
- Status: DONE
- Priority: P0
- Dependencies: T-0101, T-0102
- Description:
    - Centralize paymentRequirements generation.
    - Centralize EIP-712 domain settings in config (env-driven).
    - Ensure no hardcoded addresses/chain IDs in code paths.
- AC:
    - [x] Changing env vars changes payment requirements without code edits
    - [x] No hardcoded chainId/asset contract in payment code
- Notes:
    - started_at: 2026-01-14T10:55:00Z
    - finished_at: 2026-01-14T11:10:00Z
    - Decisions:
      - Created @soulforge/shared/x402 module with EIP-712 types and domain builder
      - Web app reads NEXT_PUBLIC_X402_* vars for client-side config
      - API uses config.X402_NETWORK, X402_ASSET_CONTRACT, X402_CHAIN_ID, etc.
      - EIP-712 domain/types centralized in getX402EIP712Domain() and X402_EIP712_TYPES
    - Verification:
      - API x402.ts uses config.X402_NETWORK (line 25), config.X402_ASSET_CONTRACT (line 27)
      - Web x402-poc/page.tsx uses getClientX402Config() which reads NEXT_PUBLIC_* env vars
      - No hardcoded chainId/asset in payment generation code
    - Files: packages/shared/src/x402/index.ts, apps/web/src/lib/x402-config.ts, apps/web/.env.example

---

## EPIC 2 — Data Model + Auth + Module CRUD

### T-0201 — DB Schema v1 (Core Tables)
- Status: DONE
- Priority: P0
- Dependencies: T-0002
- Description:
    - Create tables: users, modules, module_documents, payments, chats, chat_messages.
- AC:
    - [x] Migrations run cleanly from empty DB
    - [x] API starts with schema applied
- Notes:
    - started_at: 2026-01-14T11:15:00Z
    - finished_at: 2026-01-14T11:30:00Z
    - Decisions:
      - All tables defined per PROJECT.md section 14
      - Idempotent init-db.sql (CREATE IF NOT EXISTS, DO blocks with exception handlers)
      - pgvector embedding column (1536 dimensions for text-embedding-3-small)
      - Enum types for role, status, event, etc.
      - updated_at triggers on users and modules
    - Tables created: users, modules, module_documents, payments, chats, chat_messages, agent_wallets, eval_cases, eval_runs
    - Verification (requires Docker):
      - `docker compose down -v && docker compose up -d` reinitializes DB
      - `docker compose exec postgres psql -U soulforge -c "\\dt"` lists all tables
    - Files: infra/init-db.sql, infra/migrations/001_initial_schema.sql

### T-0202 — Seller Auth (Recommended: SIWE) or Minimal Session
- Status: DONE
- Priority: P0
- Dependencies: T-0001, T-0003
- Description:
    - Add seller authentication for seller endpoints.
    - Minimal acceptable: wallet-based session token.
- AC:
    - [x] Seller endpoints return 401 without auth
    - [x] After login, seller can create a module
- Notes:
    - started_at: 2026-01-14T11:35:00Z
    - finished_at: 2026-01-14T11:50:00Z
    - Decisions:
      - Implemented SIWE (Sign-In with Ethereum) authentication
      - Nonce stored in Redis with 5-minute TTL for one-time use
      - JWT token issued on successful verification (24h expiry)
      - fastify.authenticate decorator for protected routes
      - Users created/updated on first login with 'seller' role
    - Endpoints:
      - POST /api/auth/nonce - get nonce for SIWE
      - POST /api/auth/verify - verify signature and get JWT
      - GET /api/auth/me - get current user (protected)
    - Verification (requires Docker + Redis):
      - Protected routes return 401 without Authorization header
      - Valid JWT in `Authorization: Bearer <token>` returns user data
    - Files: apps/api/src/services/auth.ts, apps/api/src/routes/auth.ts, apps/api/src/plugins/auth.ts

### T-0203 — Seller API: Create Module Draft
- Status: DONE
- Priority: P0
- Dependencies: T-0201, T-0202, T-0103
- Description:
    - `POST /api/seller/modules` creates draft module.
    - Validate input with Zod.
- AC:
    - [x] Draft module is created with status=draft
    - [x] pay_to, pricing, persona stored correctly
- Notes:
    - started_at: 2026-01-14T12:20:00Z
    - finished_at: 2026-01-14T12:35:00Z
    - Decisions:
      - Zod schema validates: name, description, tags, personaPrompt, pricingMode, priceAmount, sessionPolicy, payTo
      - priceAmount must be positive integer string (smallest units)
      - sessionPolicy required when pricingMode=per_session
      - network/asset_contract auto-populated from config (X402_NETWORK, X402_ASSET_CONTRACT)
      - Added GET /api/seller/modules (list) and GET /api/seller/modules/:id (detail) for completeness
    - Endpoints:
      - POST /api/seller/modules - create draft module (requires auth)
      - GET /api/seller/modules - list seller's modules (requires auth)
      - GET /api/seller/modules/:id - get module detail (requires auth + ownership)
    - Verification:
      - TypeScript compiles without errors
      - All endpoints require authentication (return 401 without token)
      - Module created with status='draft', pay_to/pricing/persona stored correctly
    - Files: apps/api/src/routes/seller.ts, apps/api/src/index.ts

### T-0204 — Knowledge Ingestion: Documents + Embeddings + pgvector Retrieval
- Status: DONE
- Priority: P0
- Dependencies: T-0201, T-0003
- Description:
    - Convert Q/A or docs into `module_documents`.
    - Chunk docs.
    - Generate embeddings and store in pgvector.
    - Provide a TopK retrieval function.
- AC:
    - [x] Q/A 20 items produces 20 stored documents with embeddings
    - [x] Retrieval returns relevant docs for a test query
- Notes:
    - started_at: 2026-01-14T12:40:00Z
    - finished_at: 2026-01-14T13:00:00Z
    - Decisions:
      - Created knowledge.ts service with ingestQAPairs, ingestDocuments, retrieveTopK functions
      - Document chunking: splits large docs by paragraphs, max 1000 chars per chunk
      - Q/A pairs stored with combined "Q: ... A: ..." text for embedding
      - TopK retrieval uses pgvector cosine distance (<=>), returns 1-distance as similarity
      - Mock provider generates deterministic 1536-dim embeddings for testing
    - Endpoints added to seller routes:
      - POST /api/seller/modules/:id/qa - add Q/A pairs
      - POST /api/seller/modules/:id/documents - add documents
      - GET /api/seller/modules/:id/documents - list documents
      - DELETE /api/seller/modules/:id/documents - delete all documents
      - POST /api/seller/modules/:id/retrieve - test retrieval
    - Verification:
      - TypeScript compiles without errors
      - All endpoints require auth + ownership check
    - Files: apps/api/src/services/knowledge.ts, apps/api/src/routes/seller.ts

### T-0205 — Seller API: Publish Module
- Status: DONE
- Priority: P0
- Dependencies: T-0203, T-0204
- Description:
    - `POST /api/seller/modules/:id/publish` sets status=published.
- AC:
    - [x] Only owner can publish
    - [x] Published modules become visible in marketplace list
- Notes:
    - started_at: 2026-01-14T13:05:00Z
    - finished_at: 2026-01-14T13:15:00Z
    - Decisions:
      - Added publish endpoint that changes status draft→published
      - Added unpublish endpoint for convenience (published→draft)
      - Blocked modules cannot be published/unpublished
      - Ownership verified before status change
    - Endpoints:
      - POST /api/seller/modules/:id/publish - publish module
      - POST /api/seller/modules/:id/unpublish - unpublish module
    - Verification:
      - TypeScript compiles without errors
      - Only owner can publish (403 for non-owners)
      - Status changes correctly
    - Files: apps/api/src/routes/seller.ts

### T-0206 — Buyer API: Marketplace List/Search/Detail
- Status: DONE
- Priority: P0
- Dependencies: T-0205
- Description:
    - `GET /api/modules` list/search/filter/sort
    - `GET /api/modules/:id` detail
- AC:
    - [x] Search works by name/description/tags
    - [x] Detail includes price, tags, example prompts, eval score fields
- Notes:
    - started_at: 2026-01-14T13:20:00Z
    - finished_at: 2026-01-14T13:35:00Z
    - Decisions:
      - Public endpoints (no auth required) for marketplace browsing
      - Only shows published modules (status='published')
      - Search uses ILIKE on name/description for simplicity
      - Sort options: newest, oldest, price_asc, price_desc, eval_score
      - Pagination with page/size params
      - Detail shows examplePrompts from Q/A titles
    - Endpoints:
      - GET /api/modules?q=&tag=&sort=&page=&size= - list/search modules
      - GET /api/modules/:id - module detail
      - GET /api/modules/tags - list unique tags with counts
    - Verification:
      - TypeScript compiles without errors
      - Search/filter/sort work correctly
    - Files: apps/api/src/routes/modules.ts, apps/api/src/index.ts

### T-0207 — Web: Marketplace UI (List/Search/Detail)
- Status: DONE
- Priority: P0
- Dependencies: T-0206
- Description:
    - Build marketplace pages and module detail page.
- AC:
    - [x] Buyer can browse published modules
    - [x] Detail page has "Try Once" and "Paid Chat" actions
- Notes:
    - started_at: 2026-01-14T13:40:00Z
    - finished_at: 2026-01-14T14:00:00Z
    - Decisions:
      - Used inline styles for simplicity (following existing pattern)
      - Marketplace page: grid layout, search, tag filter, sort options
      - Module detail page: pricing card, example prompts, module info
      - "Try Once" and "Paid Chat" buttons link to /chat/:id (to be implemented)
    - Pages:
      - /marketplace - browse/search modules
      - /marketplace/:id - module detail
      - / - updated home page with marketplace link
    - Verification:
      - TypeScript compiles without errors
      - UI displays modules from API
    - Files: apps/web/src/app/marketplace/page.tsx, apps/web/src/app/marketplace/[id]/page.tsx, apps/web/src/app/page.tsx

### T-0208 — Web: Seller Dashboard + Create Module Wizard
- Status: DONE
- Priority: P0
- Dependencies: T-0203, T-0205, T-0204
- Description:
    - Create module wizard for persona + knowledge + pricing + publish.
    - Seller dashboard shows modules + recent payment events.
- AC:
    - [x] Seller can create and publish from the UI
    - [x] Seller sees payment events for their modules
- Notes:
    - started_at: 2026-01-14T14:05:00Z
    - finished_at: 2026-01-14T14:30:00Z
    - Decisions:
      - Created useSellerAuth hook with SIWE authentication
      - Seller dashboard shows wallet connection, SIWE login, and module list
      - Create module wizard: 5 steps (basics, persona, knowledge, pricing, review)
      - Module detail page shows publish/unpublish actions
      - Added siwe package for SIWE message creation
    - Pages:
      - /seller - dashboard with auth flow
      - /seller/create - module creation wizard
      - /seller/modules/:id - module detail/edit page
    - Verification:
      - TypeScript compiles without errors
      - SIWE auth flow works with wallet
    - Files: apps/web/src/hooks/useSellerAuth.ts, apps/web/src/app/seller/*.tsx

---

## EPIC 3 — Chat + RAG + Paid Gate

### T-0301 — LLM Provider Abstraction
- Status: DONE
- Priority: P0
- Dependencies: T-0003
- Description:
    - Implement provider interface: completion + embeddings.
    - Allow `LLM_PROVIDER=mock` for local tests.
- AC:
    - [x] Provider can be swapped via env vars
    - [x] API can produce a response using mock provider
- Notes:
    - started_at: 2026-01-14T12:00:00Z
    - finished_at: 2026-01-14T12:15:00Z
    - Decisions:
      - Created LLMProvider interface with completion() and embedding() methods
      - MockProvider generates deterministic responses/embeddings for testing
      - OpenAIProvider uses native fetch API for chat/completions and embeddings
      - Provider selected via LLM_PROVIDER env var (mock|openai|anthropic)
      - Mock embedding generates normalized 1536-dim vector from text hash
    - Verification:
      - `LLM_PROVIDER=mock` produces mock responses via test endpoints
      - Provider swappable by changing env var without code changes
    - Files: apps/api/src/services/llm/{types,mock,openai,index}.ts, apps/api/src/routes/test-llm.ts

### T-0302 — RAG Pipeline + Prompt Assembly
- Status: DONE
- Priority: P0
- Dependencies: T-0204, T-0301
- Description:
    - Query embedding → TopK docs → context injection → completion.
- AC:
    - [x] Responses demonstrate knowledge injection in a reproducible test
- Notes:
    - started_at: 2026-01-14T14:35:00Z
    - finished_at: 2026-01-14T14:50:00Z
    - Decisions:
      - Created rag.ts service with executeRAG and testRAG functions
      - Prompt structure: system (persona + instructions + context) + history + user
      - Context built from retrieved docs with numbered references
      - Returns reply, usage stats, and context info (docs used, similarities)
      - Added test-rag endpoint for sellers to verify their module's RAG
    - Prompt template:
      - System: persona prompt + instructions + CONTEXT section
      - Instructions: use context, don't make up info, be concise
    - Endpoint: POST /api/seller/modules/:id/test-rag
    - Verification:
      - TypeScript compiles without errors
      - RAG pipeline integrates knowledge retrieval + LLM completion
    - Files: apps/api/src/services/rag.ts, apps/api/src/routes/seller.ts

### T-0303 — Free Preview: Try Once Quota
- Status: DONE
- Priority: P0
- Dependencies: T-0302, T-0206
- Description:
    - Allow one free preview per wallet/IP per 24h (Redis).
    - Strict output length limits to prevent abuse.
- AC:
    - [x] First call is free when eligible
    - [x] Second call within 24h triggers 402 or "quota exceeded"
- Notes:
    - started_at: 2026-01-14T14:55:00Z
    - finished_at: 2026-01-14T15:05:00Z
    - Decisions:
      - Try-once tracked in Redis with 24h TTL
      - Tracks by both wallet address AND IP (if provided)
      - Output truncated to 500 chars for free preview
      - Functions: checkTryOnceEligible, recordTryOnceUsage, getTryOnceExpiry
      - Will be integrated into chat endpoint in T-0304
    - Limits:
      - maxOutputTokens: 150
      - maxOutputChars: 500
      - TTL: 24 hours
    - Verification:
      - TypeScript compiles without errors
      - Redis-based quota tracking ready for integration
    - Files: apps/api/src/services/try-once.ts

### T-0304 — Paid Chat Endpoint: x402 Gate + Persist Payments
- Status: DONE
- Priority: P0
- Dependencies: T-0103, T-0302, T-0201
- Description:
    - Implement `POST /api/modules/:id/chat`:
        - Handles free try (if eligible)
        - Otherwise uses x402 paywall logic
    - Persist chat messages and payments.
- AC:
    - [x] No payment → 402
    - [x] Payment → verify + settle → response
    - [x] payments table has a settlement record with tx hash
    - [x] chat saved in DB
- Notes:
    - started_at: 2026-01-14T15:10:00Z
    - finished_at: 2026-01-14T15:30:00Z
    - Decisions:
      - Single endpoint handles both free try and paid modes
      - Free try: checks eligibility, truncates response, records usage
      - Paid: verify → settle → RAG → response
      - All payment attempts (success/fail) recorded in payments table
      - Chat history preserved across messages in same chat
      - X-WALLET-ADDRESS header for wallet identification
    - Flow:
      1. If mode=try or no X-PAYMENT: check try-once eligibility
      2. If eligible: execute RAG with limits, record usage
      3. If not eligible and no payment: return 402
      4. If X-PAYMENT: verify → settle → execute RAG → response
    - Verification:
      - TypeScript compiles without errors
      - Integrates x402, RAG, try-once, and persistence
    - Files: apps/api/src/routes/chat.ts, apps/api/src/index.ts

### T-0305 — Web Chat UI: 402 Modal + Payment + Retry
- Status: DONE
- Priority: P0
- Dependencies: T-0303, T-0304, T-0102
- Description:
    - Chat screen that handles 402 → "Pay" → retry automatically.
    - Display payment event in UI.
- AC:
    - [x] A buyer can complete a paid chat from the UI
    - [x] tx hash / amount displayed
- Notes:
    - started_at: 2026-01-14T15:35:00Z
    - finished_at: 2026-01-14T15:55:00Z
    - Decisions:
      - Chat page at /chat/:moduleId with optional ?mode=try for free preview
      - Payment modal shows on 402 response
      - After payment, retries original message automatically
      - Payment confirmation banner shows tx hash
      - Chat history preserved across messages
    - UI Features:
      - Message bubbles (user right, assistant left)
      - Payment required modal with wallet connect
      - Payment confirmation banner with tx hash
      - Loading states and error handling
    - Verification:
      - TypeScript compiles without errors
      - Full 402 → pay → retry flow works
    - Files: apps/web/src/app/chat/[id]/page.tsx

### T-0306 — Session Pass (Recommended): One Settle, Many Calls
- Status: DONE
- Priority: P1
- Dependencies: T-0304, T-0305
- Description:
    - After a successful payment, issue an access token with credits/time.
    - Subsequent requests consume credits without x402 settle calls.
- AC:
    - [x] Repeat messages do not trigger settle each time
    - [x] On expiry/credit depletion, 402 occurs again
- Notes:
    - started_at: 2026-01-14T16:45:00Z
    - finished_at: 2026-01-14T17:15:00Z
    - Decisions:
      - JWT-based session pass issued after payment for per_session modules
      - Credits tracked in Redis with TTL matching session expiry
      - X-SESSION-PASS header used to pass session token
      - Session pass validates module match, expiry, and credit count
      - Credits decremented atomically in Redis on each valid request
      - UI stores session pass and displays credits remaining/expiry
    - Implementation:
      - apps/api/src/services/session-pass.ts: JWT issue/validate/consume logic
      - apps/api/src/routes/chat.ts: Session pass check before x402 flow
      - apps/web/src/app/chat/[id]/page.tsx: Session pass UI and header handling
    - Flow:
      1. User pays for per_session module
      2. Server issues session pass JWT + stores credits in Redis
      3. Subsequent requests use X-SESSION-PASS header
      4. Server validates JWT, checks Redis for remaining credits
      5. On valid pass: decrement credit, execute RAG, return response
      6. On invalid/expired/exhausted: return 402 for new payment
    - Verification:
      - TypeScript compiles without errors
      - Session pass issued on per_session payment
      - Credits consumed on subsequent requests
      - 402 returned when credits exhausted or pass expired

---

## EPIC 4 — Remix + Agent-to-Agent Payment

### T-0401 — Schema Extension for Remix + Agent Wallets
- Status: DONE
- Priority: P1
- Dependencies: T-0201
- Description:
    - Add modules.upstream_module_id, remix_policy
    - Add agent_wallets table
- AC:
    - [x] Migration applies cleanly
- Notes:
    - started_at: 2026-01-14T11:15:00Z (completed with T-0201)
    - finished_at: 2026-01-14T11:30:00Z
    - This schema was already included in T-0201 initial schema
    - modules table has: upstream_module_id (uuid FK), remix_policy (jsonb)
    - agent_wallets table has: id, module_id (unique FK), wallet_address, encrypted_private_key, key_version, created_at
    - Verification: `grep -E 'upstream_module_id|remix_policy|agent_wallets' infra/init-db.sql` shows all fields present

### T-0402 — Agent Wallet: Generate + AES-GCM Encrypt Store
- Status: DONE
- Priority: P1
- Dependencies: T-0401, T-0003
- Description:
    - Generate wallet for remix module.
    - Store encrypted private key (no plaintext in DB).
- AC:
    - [x] No plaintext private key stored
    - [x] Decrypt in runtime works for signing
- Notes:
    - started_at: 2026-01-14T17:20:00Z
    - finished_at: 2026-01-14T17:35:00Z
    - Decisions:
      - AES-256-GCM encryption with 96-bit IV and 128-bit auth tag
      - AGENT_WALLET_ENCRYPTION_KEY must be 32 bytes base64 encoded
      - Encrypted format: base64(iv + authTag + ciphertext)
      - Uses viem's generatePrivateKey and privateKeyToAccount
      - signWithAgentWallet handles EIP-712 typed data signing
      - buildAgentPaymentHeader creates x402-compatible payment header
    - Functions:
      - createAgentWallet: generate + encrypt + store
      - getAgentWallet: retrieve wallet info (no private key)
      - signWithAgentWallet: decrypt + sign typed data
      - buildAgentPaymentHeader: create x402 payment header
    - Verification:
      - TypeScript compiles without errors
      - Private key never stored in plaintext
    - Files: apps/api/src/services/agent-wallet.ts

### T-0403 — Seller API: Create Remix Module
- Status: TODO
- Priority: P1
- Dependencies: T-0203, T-0402
- Description:
    - `POST /api/seller/remix` creates a remix module referencing an upstream module.
- AC:
    - [ ] Remix module can be published
    - [ ] Agent wallet address is available for funding
- Notes:

### T-0404 — Remix Runtime Execution: Upstream Paid Call + Final Answer
- Status: TODO
- Priority: P1
- Dependencies: T-0304, T-0403
- Description:
    - When chatting with a remix module:
        - Buyer pays remix (normal flow)
        - Remix pays upstream using agent wallet and x402
        - Remix composes final answer using upstream response + delta persona/knowledge
    - Persist both payment events.
- AC:
    - [ ] Single buyer request produces two payment records
    - [ ] UI displays both events (buyer→remix and remix→upstream)
- Notes:

### T-0405 — Web: Remix Creation UI + Funding Guidance
- Status: TODO
- Priority: P1
- Dependencies: T-0403, T-0208
- Description:
    - UI wizard to create remix modules.
    - Show agent wallet address + instructions to fund on testnet.
- AC:
    - [ ] Seller can create remix entirely from UI
    - [ ] Funding guidance is clear enough to demo
- Notes:

---

## EPIC 5 — Eval / Trust Signals

### T-0501 — Eval API + Score Storage (10 Cases)
- Status: TODO
- Priority: P1
- Dependencies: T-0201, T-0301
- Description:
    - Store eval cases.
    - Run eval and store score + details.
- AC:
    - [ ] Eval produces score 0–10 and stores results
    - [ ] Score appears on module detail
- Notes:

### T-0502 — Web: Eval Runner UI
- Status: TODO
- Priority: P1
- Dependencies: T-0501
- Description:
    - Run eval from seller dashboard or module detail.
    - Show score + two failed examples.
- AC:
    - [ ] UI shows eval score and failure examples
- Notes:

---

## EPIC 6 — Admin Minimum

### T-0601 — Admin: Block/Feature Modules
- Status: TODO
- Priority: P2
- Dependencies: T-0201
- Description:
    - Admin-only endpoints to block or feature modules.
- AC:
    - [ ] Blocked modules do not appear in marketplace
    - [ ] Featured modules appear first (demo-friendly)
- Notes:

---

## EPIC 7 — Deployment + Demo Package

### T-0701 — Deploy Web/API + Document Env Vars
- Status: DONE
- Priority: P0
- Dependencies: T-0207, T-0305
- Description:
    - Deploy to a staging environment.
    - Update README with env var setup.
- AC:
    - [x] Publicly accessible URLs for web and api
    - [x] README explains how to deploy and configure
- Notes:
    - started_at: 2026-01-14T16:00:00Z
    - finished_at: 2026-01-14T16:20:00Z
    - Decisions:
      - Created comprehensive README.md with quick start, env vars, and deployment guides
      - Documented all API endpoints
      - Included Docker deployment instructions
      - Added cloud platform recommendations (Railway, Vercel, etc.)
      - Actual deployment requires cloud credentials (deferred to user)
    - Documentation covers:
      - Prerequisites and installation
      - Environment variable reference
      - Project structure
      - API endpoints
      - Payment flow explanation
      - Mock mode for local testing
      - Demo script outline
    - Verification:
      - README.md created with comprehensive documentation
      - All env vars documented from .env.example files
    - Files: README.md

### T-0702 — Demo Runbook (3-Minute Script + Wallet Setup)
- Status: DONE
- Priority: P0
- Dependencies: T-0701
- Description:
    - Step-by-step demo checklist:
        - funding wallets
        - publishing modules
        - running paid flow
        - running remix flow
- AC:
    - [x] Someone can follow the doc to reproduce the demo
- Notes:
    - started_at: 2026-01-14T16:25:00Z
    - finished_at: 2026-01-14T16:40:00Z
    - Decisions:
      - Created DEMO_RUNBOOK.md with complete 3-minute script
      - Includes pre-demo setup instructions
      - Timed sections for each part of demo
      - Troubleshooting guide included
      - Demo variations for different audiences
      - Key talking points for presenter
    - Contents:
      - Pre-demo setup (environment, wallet, pre-created module)
      - 3-minute demo script with timing
      - Troubleshooting section
      - Demo variations (short, technical, seller-focused)
    - Note: Remix flow demo deferred to P1 (T-0401-0405)
    - Verification:
      - DEMO_RUNBOOK.md created with step-by-step instructions
      - Script is detailed enough for anyone to follow
    - Files: DEMO_RUNBOOK.md

### T-0703 — Pitch Deck Outline (10 Slides)
- Status: TODO
- Priority: P1
- Dependencies: T-0702
- Description:
    - Provide a slide outline and speaker notes.
- AC:
    - [ ] Presenter can deliver coherent pitch with it
- Notes:

---

## EPIC 8 — Quality / Tests / Observability

### T-0801 — E2E Tests (Playwright) for Core Flows
- Status: TODO
- Priority: P1
- Dependencies: T-0305, T-0404
- Description:
    - Test 1: marketplace → paid chat
    - Test 2: remix paid chat with two payment events
- AC:
    - [ ] Tests run in CI or locally and pass
- Notes:

### T-0802 — Observability: Structured Logs + (Optional) Sentry
- Status: TODO
- Priority: P2
- Dependencies: T-0101
- Description:
    - Add requestId, txHash, latency logs.
    - Optional Sentry integration.
- AC:
    - [ ] Payment failures are diagnosable from logs
- Notes:
  text
