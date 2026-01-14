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
- Status: TODO
- Priority: P0
- Dependencies: T-0001
- Description:
    - Add docker-compose with Postgres and Redis.
    - Enable pgvector extension.
    - Add a health endpoint in API to confirm DB connectivity.
- AC:
    - [ ] `docker-compose up` starts postgres + redis
    - [ ] pgvector extension is installed (verified in migration or init script)
    - [ ] `GET /health/db` returns OK when DB is up
- Notes:

### T-0003 — Config System + .env.example (No Hardcoding)
- Status: TODO
- Priority: P0
- Dependencies: T-0001
- Description:
    - Add `.env.example` for web and api with all required variables.
    - Fail fast with clear error messages when required env vars are missing.
- AC:
    - [ ] `.env.example` includes DB/Redis/LLM/x402/security vars
    - [ ] App crashes early with a clear “missing env var” message
- Notes:

---

## EPIC 1 — x402 End-to-End Proof (Ship This First)

### T-0101 — Backend x402 POC: 402 → Verify/Settle → 200
- Status: TODO
- Priority: P0
- Dependencies: T-0002, T-0003
- Description:
    - Implement `/api/premium/echo` (or similar).
    - If no `X-PAYMENT`, return 402 + paymentRequirements.
    - If `X-PAYMENT` present, call facilitator verify + settle.
    - Record result to `payments` table.
- AC:
    - [ ] Without payment header: returns 402 with valid JSON paymentRequirements
    - [ ] With valid payment header: returns 200 + payload
    - [ ] On verify/settle failure: returns a clear error (402 or 4xx) and stores failure record
    - [ ] payments table stores both success and failure attempts
- Notes:

### T-0102 — Web x402 POC: Handle 402 + Wallet Sign + Retry with X-PAYMENT
- Status: TODO
- Priority: P0
- Dependencies: T-0101
- Description:
    - Minimal UI that calls `/api/premium/echo`.
    - On 402, prompt “Pay with wallet”, build X-PAYMENT, retry request.
- AC:
    - [ ] In browser, user can complete the flow to 200
    - [ ] Debug panel shows 402 response body and final 200 response
- Notes:

### T-0103 — Payment Config Abstraction (Network/Token/Domain)
- Status: TODO
- Priority: P0
- Dependencies: T-0101, T-0102
- Description:
    - Centralize paymentRequirements generation.
    - Centralize EIP-712 domain settings in config (env-driven).
    - Ensure no hardcoded addresses/chain IDs in code paths.
- AC:
    - [ ] Changing env vars changes payment requirements without code edits
    - [ ] No hardcoded chainId/asset contract in payment code
- Notes:

---

## EPIC 2 — Data Model + Auth + Module CRUD

### T-0201 — DB Schema v1 (Core Tables)
- Status: TODO
- Priority: P0
- Dependencies: T-0002
- Description:
    - Create tables: users, modules, module_documents, payments, chats, chat_messages.
- AC:
    - [ ] Migrations run cleanly from empty DB
    - [ ] API starts with schema applied
- Notes:

### T-0202 — Seller Auth (Recommended: SIWE) or Minimal Session
- Status: TODO
- Priority: P0
- Dependencies: T-0001, T-0003
- Description:
    - Add seller authentication for seller endpoints.
    - Minimal acceptable: wallet-based session token.
- AC:
    - [ ] Seller endpoints return 401 without auth
    - [ ] After login, seller can create a module
- Notes:

### T-0203 — Seller API: Create Module Draft
- Status: TODO
- Priority: P0
- Dependencies: T-0201, T-0202, T-0103
- Description:
    - `POST /api/seller/modules` creates draft module.
    - Validate input with Zod.
- AC:
    - [ ] Draft module is created with status=draft
    - [ ] pay_to, pricing, persona stored correctly
- Notes:

### T-0204 — Knowledge Ingestion: Documents + Embeddings + pgvector Retrieval
- Status: TODO
- Priority: P0
- Dependencies: T-0201, T-0003
- Description:
    - Convert Q/A or docs into `module_documents`.
    - Chunk docs.
    - Generate embeddings and store in pgvector.
    - Provide a TopK retrieval function.
- AC:
    - [ ] Q/A 20 items produces 20 stored documents with embeddings
    - [ ] Retrieval returns relevant docs for a test query
- Notes:

### T-0205 — Seller API: Publish Module
- Status: TODO
- Priority: P0
- Dependencies: T-0203, T-0204
- Description:
    - `POST /api/seller/modules/:id/publish` sets status=published.
- AC:
    - [ ] Only owner can publish
    - [ ] Published modules become visible in marketplace list
- Notes:

### T-0206 — Buyer API: Marketplace List/Search/Detail
- Status: TODO
- Priority: P0
- Dependencies: T-0205
- Description:
    - `GET /api/modules` list/search/filter/sort
    - `GET /api/modules/:id` detail
- AC:
    - [ ] Search works by name/description/tags
    - [ ] Detail includes price, tags, example prompts, eval score fields
- Notes:

### T-0207 — Web: Marketplace UI (List/Search/Detail)
- Status: TODO
- Priority: P0
- Dependencies: T-0206
- Description:
    - Build marketplace pages and module detail page.
- AC:
    - [ ] Buyer can browse published modules
    - [ ] Detail page has “Try Once” and “Paid Chat” actions
- Notes:

### T-0208 — Web: Seller Dashboard + Create Module Wizard
- Status: TODO
- Priority: P0
- Dependencies: T-0203, T-0205, T-0204
- Description:
    - Create module wizard for persona + knowledge + pricing + publish.
    - Seller dashboard shows modules + recent payment events.
- AC:
    - [ ] Seller can create and publish from the UI
    - [ ] Seller sees payment events for their modules
- Notes:

---

## EPIC 3 — Chat + RAG + Paid Gate

### T-0301 — LLM Provider Abstraction
- Status: TODO
- Priority: P0
- Dependencies: T-0003
- Description:
    - Implement provider interface: completion + embeddings.
    - Allow `LLM_PROVIDER=mock` for local tests.
- AC:
    - [ ] Provider can be swapped via env vars
    - [ ] API can produce a response using mock provider
- Notes:

### T-0302 — RAG Pipeline + Prompt Assembly
- Status: TODO
- Priority: P0
- Dependencies: T-0204, T-0301
- Description:
    - Query embedding → TopK docs → context injection → completion.
- AC:
    - [ ] Responses demonstrate knowledge injection in a reproducible test
- Notes:

### T-0303 — Free Preview: Try Once Quota
- Status: TODO
- Priority: P0
- Dependencies: T-0302, T-0206
- Description:
    - Allow one free preview per wallet/IP per 24h (Redis).
    - Strict output length limits to prevent abuse.
- AC:
    - [ ] First call is free when eligible
    - [ ] Second call within 24h triggers 402 or “quota exceeded”
- Notes:

### T-0304 — Paid Chat Endpoint: x402 Gate + Persist Payments
- Status: TODO
- Priority: P0
- Dependencies: T-0103, T-0302, T-0201
- Description:
    - Implement `POST /api/modules/:id/chat`:
        - Handles free try (if eligible)
        - Otherwise uses x402 paywall logic
    - Persist chat messages and payments.
- AC:
    - [ ] No payment → 402
    - [ ] Payment → verify + settle → response
    - [ ] payments table has a settlement record with tx hash
    - [ ] chat saved in DB
- Notes:

### T-0305 — Web Chat UI: 402 Modal + Payment + Retry
- Status: TODO
- Priority: P0
- Dependencies: T-0303, T-0304, T-0102
- Description:
    - Chat screen that handles 402 → “Pay” → retry automatically.
    - Display payment event in UI.
- AC:
    - [ ] A buyer can complete a paid chat from the UI
    - [ ] tx hash / amount displayed
- Notes:

### T-0306 — Session Pass (Recommended): One Settle, Many Calls
- Status: TODO
- Priority: P1
- Dependencies: T-0304, T-0305
- Description:
    - After a successful payment, issue an access token with credits/time.
    - Subsequent requests consume credits without x402 settle calls.
- AC:
    - [ ] Repeat messages do not trigger settle each time
    - [ ] On expiry/credit depletion, 402 occurs again
- Notes:

---

## EPIC 4 — Remix + Agent-to-Agent Payment

### T-0401 — Schema Extension for Remix + Agent Wallets
- Status: TODO
- Priority: P1
- Dependencies: T-0201
- Description:
    - Add modules.upstream_module_id, remix_policy
    - Add agent_wallets table
- AC:
    - [ ] Migration applies cleanly
- Notes:

### T-0402 — Agent Wallet: Generate + AES-GCM Encrypt Store
- Status: TODO
- Priority: P1
- Dependencies: T-0401, T-0003
- Description:
    - Generate wallet for remix module.
    - Store encrypted private key (no plaintext in DB).
- AC:
    - [ ] No plaintext private key stored
    - [ ] Decrypt in runtime works for signing
- Notes:

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
- Status: TODO
- Priority: P0
- Dependencies: T-0207, T-0305
- Description:
    - Deploy to a staging environment.
    - Update README with env var setup.
- AC:
    - [ ] Publicly accessible URLs for web and api
    - [ ] README explains how to deploy and configure
- Notes:

### T-0702 — Demo Runbook (3-Minute Script + Wallet Setup)
- Status: TODO
- Priority: P0
- Dependencies: T-0701
- Description:
    - Step-by-step demo checklist:
        - funding wallets
        - publishing modules
        - running paid flow
        - running remix flow
- AC:
    - [ ] Someone can follow the doc to reproduce the demo
- Notes:

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
