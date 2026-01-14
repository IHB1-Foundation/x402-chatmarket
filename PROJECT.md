# PROJECT.md

## 1) Project Name
SoulForge (Hackathon Edition)

## 2) One‑Line Definition
A **hosted AI persona + knowledge module marketplace** where modules are sold as **paywalled API capabilities** (not files), using **x402 (HTTP 402 Payment Required)** to enforce payment‑gated access. Includes **Remix modules** that pay upstream modules at runtime (agent‑to‑agent payment) to prove “derivatives generate revenue for originals” **without data copying**.

---

## 3) Why This Hackathon Version Exists
Shipping “chat history NFTs / IPFS encrypted vectors” creates immediate controversy and risk (copying, rights, PII) and distracts from what wins hackathons:
1) A **real working x402 paywall** (402 → wallet signature → verify/settle → content).
2) A **market flow** with visible payment events (tx hash / settlement event).
3) A **Remix demo** where a derivative module automatically pays an original module.

This version is deliberately designed to:
- Prove product viability with minimal legal/ethical landmines.
- Keep scope buildable in 7–14 days.
- Maximize “tech + demo clarity” for judges.

---

## 4) Goals (Must Ship)
### G1 — x402 Payment‑Gated Access Works End‑to‑End
- A paid endpoint returns **HTTP 402** when no valid payment header exists.
- With a valid payment header:
    - Server verifies + settles payment via facilitator (or equivalent backend).
    - Only after settlement success, the server returns the AI response.
- All outcomes (success/fail) are recorded.

### G2 — Marketplace Feels Like a Product
- Seller can create/publish modules (persona + knowledge + price).
- Buyer can browse/search modules and pay to use them.
- Seller can see revenue + recent payment events.

### G3 — Remix Proves Derivative Economics Without Data Copying
- Remix module does **not** copy upstream data.
- Remix module calls upstream at runtime and **pays upstream** (agent‑to‑agent).
- UI shows **two payment events** for a single buyer request:
    - Buyer → Remix (payment #1)
    - Remix agent wallet → Upstream (payment #2)

---

## 5) Non‑Goals (Explicitly Out of Scope for Hackathon)
Do **NOT** implement:
- NFT minting, IPFS storage, encryption key distribution.
- Selling raw chat history or raw embeddings as downloadable assets.
- On‑chain royalty splitter contracts (optional later; not needed for hackathon).
- Fine‑tuning/GPU inference infrastructure.
- Full content moderation pipeline (only minimal admin block + basic heuristics).
- Enterprise auth/roles beyond minimal admin.

---

## 6) Core Concepts & Product Definitions
### 6.1 Module (Base Module)
A Module is a hosted capability defined by:
- Persona prompt (system prompt / style / constraints)
- Knowledge pack (Q/A list and/or documents)
- Retrieval pipeline (RAG) used to answer queries
- Price policy (per‑message or session pass)
- Pay‑to address (seller revenue address)

**Important**: The module is accessed via API. The buyer never downloads the “asset.”

### 6.2 Knowledge Pack (Allowed Inputs for Hackathon)
To avoid PII/rights issues:
- Preferred: curated Q/A pairs (20–200)
- Optional: small documents (1–3 text files), chunked and embedded
- No “upload your private chat history” feature in hackathon scope

### 6.3 Paid Access = x402 Paywall
When buyer hits a paid endpoint:
- If payment missing/invalid → HTTP 402 + payment requirements
- If payment valid → verify + settle → return AI output

### 6.4 Remix Module (Derivative Module)
A Remix Module:
- References a base module (upstream).
- Adds delta persona rules and optional delta knowledge.
- At runtime, it calls upstream to get an upstream answer and then produces a final answer.

**Key property**: Remix pays upstream at runtime with an agent wallet.

---

## 7) User Roles & Primary User Stories
### Buyer
- Browse modules, run “Try Once” preview, then pay for usage.
- See payment confirmation (tx hash / settlement event) in the UI.

### Seller (Creator)
- Create/publish modules (no code).
- Set price and see revenue.
- Create remix modules and see both revenue and upstream costs.

### Admin (Minimal)
- Block a module (status: blocked).
- Optionally feature modules for demo.

---

## 8) UX Flows
### 8.1 Buyer Flow (Marketplace → Pay → Chat)
1) Marketplace list/search
2) Module detail (price, tags, example prompts, eval score)
3) Try Once (free preview) OR Paid Chat
4) Paid Chat:
    - First request gets 402
    - UI prompts “Pay with wallet”
    - Wallet signature generates X‑PAYMENT
    - Retry request → 200 response
5) UI displays:
    - Assistant reply
    - Payment event (tx hash, amount, payTo)

### 8.2 Seller Flow (Dashboard → Create Module Wizard → Publish)
Wizard steps:
1) Basics: name, description, tags
2) Persona: system prompt
3) Knowledge: Q/A paste or doc upload
4) Pricing: per‑message or session pass
5) Eval: 10 test cases (optional in P0, required in P1)
6) Publish

### 8.3 Remix Flow
1) Seller selects an upstream module.
2) Defines delta persona + delta knowledge + pricing.
3) System creates an agent wallet for the remix module (server‑managed, encrypted).
4) Seller funds agent wallet on testnet.
5) Buyer uses remix module:
    - Buyer pays remix
    - Remix agent wallet pays upstream during execution
    - UI shows two payment events.

---

## 9) Demo Script (3 Minutes)
**Must show:**
1) Paid endpoint returns 402, then succeeds after wallet payment.
2) Payment event is visible in UI.
3) Remix call triggers upstream paid call (two events).

**Recommended demo modules:**
- Base A: “RPG Merchant NPC”
- Remix B: “Scammy Merchant (merchant + scam persona delta)”
- (Optional) Base C: “Community FAQ bot”

---

## 10) Definition of Success
### Minimum Success (Must)
- Paid call without X‑PAYMENT returns 402.
- Paid call with valid X‑PAYMENT returns 200 only after settlement success.
- Payment events persisted in DB and visible in UI.
- Remix call produces two payment events and shows both in UI.

### Bonus (Nice)
- Session pass reduces repeated settle calls.
- Eval scores visible and affect marketplace sorting.
- Admin block/feature toggles exist.

---

## 11) Recommended Tech Stack
### Monorepo
- `apps/web`: Next.js (App Router) + TypeScript
- `apps/api`: Node.js + TypeScript (Fastify recommended)
- `packages/shared`: shared types, zod schemas, config
- `infra`: docker-compose, migrations

### Data
- Postgres + pgvector (RAG retrieval)
- Redis (rate limiting, “Try Once” quota, session pass tokens)

### Wallet / Client
- wagmi + viem for wallet connection
- EIP‑712 signing for payment authorization

### LLM Provider
- Abstracted interface: swap OpenAI/Anthropic/others by env vars

---

## 12) Architecture (High Level)
### P0 Paid Chat
Client → API `/api/modules/:id/chat`
- If no payment header → 402 + paymentRequirements
- If payment header → backend verify + settle → run RAG + LLM → return response

### P1 Remix
Client → API `/api/modules/:id/chat` (remix module)
- Buyer payment flow for remix
- Server executes remix:
    - Calls upstream `/api/modules/:upstreamId/chat` with agent wallet payment
    - Uses upstream response as context
    - Generates final response

---

## 13) Configuration & Environment Variables (Do Not Hardcode)
Provide `.env.example` in both web and api.

### Common
- `NODE_ENV`
- `APP_URL`
- `API_URL`

### Database / Cache
- `DATABASE_URL`
- `REDIS_URL`

### LLM
- `LLM_PROVIDER=openai|anthropic|mock`
- `OPENAI_API_KEY=...` (if openai)
- `LLM_MODEL=...`
- `EMBEDDING_MODEL=...`

### x402 / Payment
- `X402_FACILITATOR_BASE_URL=...`
- `X402_NETWORK=...` (e.g., cronos-testnet)
- `X402_ASSET_CONTRACT=...` (USDC.e contract)
- `X402_ASSET_DECIMALS=6`
- `X402_EIP712_NAME=...`
- `X402_EIP712_VERSION=...`
- `X402_CHAIN_ID=...`
- `X402_MOCK_MODE=false` (default false)

### Security
- `JWT_SECRET=...` (if using sessions/SIWE)
- `AGENT_WALLET_ENCRYPTION_KEY=...` (32 bytes base64 for AES-GCM)

---

## 14) Data Model (Authoritative for Implementation)
### users
- id (uuid)
- wallet_address (text, unique)
- role (buyer|seller|admin)
- created_at, updated_at

### modules
- id (uuid)
- owner_user_id (uuid, FK users)
- type (base|remix)
- name, description
- tags (text[])
- status (draft|published|blocked)
- persona_prompt (text)
- pricing_mode (per_message|per_session)
- price_amount (text) // integer string in smallest units
- session_policy (jsonb nullable) // e.g., {minutes:30, messageCredits:10}
- pay_to (text)
- network (text)
- asset_contract (text)
- upstream_module_id (uuid nullable)
- remix_policy (jsonb nullable)
- eval_score (int nullable)
- last_eval_at (timestamp nullable)
- created_at, updated_at

### module_documents
- id (uuid)
- module_id (uuid FK)
- source_type (qa|doc)
- title (text)
- content (text)
- embedding (vector) // pgvector
- created_at

### chats
- id (uuid)
- module_id (uuid)
- wallet_address (text nullable)
- created_at

### chat_messages
- id (uuid)
- chat_id (uuid)
- role (system|user|assistant)
- content (text)
- token_usage (jsonb nullable)
- created_at

### payments
- id (uuid)
- module_id (uuid)
- payer_wallet (text)
- pay_to (text)
- value (text) // smallest units string
- tx_hash (text nullable)
- network (text)
- event (settled|failed)
- error (text nullable)
- created_at

### agent_wallets (P1)
- id (uuid)
- module_id (uuid FK)
- wallet_address (text)
- encrypted_private_key (text)
- key_version (int)
- created_at

### eval_cases (P1)
- id (uuid)
- module_id (uuid)
- prompt (text)
- rubric (text nullable)
- expected_keywords (text[] nullable)
- created_at

### eval_runs (P1)
- id (uuid)
- module_id (uuid)
- score (int)
- details (jsonb)
- created_at

---

## 15) API Specification (Minimum)
Base URL: `/api`

### Marketplace
- `GET /modules?q=&tag=&sort=&page=&size=`
- `GET /modules/:id`

### Seller
- `POST /seller/auth/siwe` (optional but recommended)
- `POST /seller/modules` (create draft)
- `POST /seller/modules/:id/publish`
- `POST /seller/modules/:id/eval` (P1)
- `POST /seller/remix` (P1)

### Chat (Try Once + Paid)
- `POST /modules/:id/chat`
    - If no `X-PAYMENT` and user not eligible for free try → return 402
    - If eligible for free try → return 200 but enforce strict quota
    - If `X-PAYMENT` exists → verify + settle → return 200

#### Chat request body
```json
{
  "chatId": "uuid-or-null",
  "message": "Hello"
}
```
402 response body (example)
```json
{
  "error": "Payment Required",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "<X402_NETWORK>",
    "payTo": "0xSellerAddress",
    "asset": "<X402_ASSET_CONTRACT>",
    "description": "module:<moduleId> / 1 message",
    "mimeType": "application/json",
    "maxAmountRequired": "10000",
    "maxTimeoutSeconds": 300
  }
}
```
200 response body (example)
```json
{
  "chatId": "uuid",
  "reply": "…",
  "payment": {
    "txHash": "0x…",
    "from": "0xPayer",
    "to": "0xPayTo",
    "value": "10000",
    "network": "<X402_NETWORK>"
  }
}
```

16) RAG & Prompting
RAG
Embed user query
Top‑K retrieve module_documents by cosine similarity
Inject context snippets into prompt
Generate final response
Prompt structure (recommended)
system: module persona prompt + safety constraints
developer: “Use only CONTEXT; if not present, say you don’t know.”
context: top‑K retrieved docs
user: user message
17) Rate Limits & Stability Strategy
Payment settlement endpoints typically have rate limits; do not design UX that triggers settle per token.
Recommended approach: Session Pass
First call: x402 settle once
Server issues access token (JWT) with credits/time
Subsequent calls consume token credits without x402 until expiry
When token expires, return 402 again
18) Security & Policy (Hackathon Minimum)
No chat-history ingestion feature.
Add checkbox + basic PII pattern warning (email/phone/ID-like strings).
Admin can block modules.
Payments:
Prevent replay by recording settled authorizations and rejecting duplicates.
Never return paid content without settlement success.
Remix agent wallet:
Encrypt keys (AES‑GCM)
No endpoints to export keys
No withdrawal endpoints
19) Deliverables (Vendor Must Produce)
Working monorepo with the required structure
.env.example + clear README for local run and deployment
docker-compose for postgres/redis + migrations
Deployed staging URLs (web + api)
Demo script + testnet funding instructions
TICKET.md fully updated (DONE/BLOCKED with notes)
(Optional) pitch deck + short demo video
20) Repository Structure (Required)
bash
/apps
  /web
  /api
/packages
  /shared
/infra
  docker-compose.yml
  migrations/ (or prisma schema)
/PROJECT.md
/TICKET.md
21) Engineering Rules
Zod validation for all external inputs.
Config-driven networking/payment constants.
Every payment attempt produces a payments record (success/fail).
One ticket at a time, always update TICKET.md state/notes.