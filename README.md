# SoulForge - AI Persona & Knowledge Module Marketplace

A hosted AI persona + knowledge module marketplace where modules are sold as paywalled API capabilities using **x402 (HTTP 402 Payment Required)** to enforce payment-gated access.

Hackathon submission draft: see `HACKATHON_SUBMISSION.md`.

## Features

- **x402 Payment-Gated Access**: Pay-per-message or pay-per-session pricing
- **RAG-Powered Responses**: Modules use retrieval-augmented generation with custom knowledge bases
- **SIWE Authentication**: Secure wallet-based seller authentication
- **Free Preview**: Try-once feature for buyers to test modules
- **Marketplace UI**: Browse, search, and discover AI modules

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: Fastify + TypeScript
- **Database**: PostgreSQL + pgvector (RAG retrieval)
- **Cache**: Redis (rate limiting, try-once quota)
- **Wallet**: wagmi + viem (EIP-712 signing)
- **LLM**: OpenAI (or mock provider for testing)

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- Docker (for PostgreSQL and Redis)

### 1. Clone and Install

```bash
git clone <repo-url>
cd x402-ctx-market
pnpm install
```

### 2. Start Infrastructure

```bash
cd infra
docker compose up -d
```

This starts:
- PostgreSQL with pgvector extension (port 5432)
- Redis (port 6379)

### 3. Configure Environment

Copy environment files and configure:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit the `.env` files as needed. For local development, the defaults work with Docker.

### 4. Start Development

```bash
pnpm dev
```

This starts:
- API server at http://localhost:3001
- Web app at http://localhost:3000

### One-Command Demos

```bash
# Seeded demo with mock payments (fastest)
pnpm demo

# Seeded demo with on-chain settlement via facilitator (Cronos Testnet)
pnpm demo:onchain
```

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Required |
| `LLM_PROVIDER` | LLM provider: `mock`, `openai`, `anthropic` | `mock` |
| `OPENAI_API_KEY` | OpenAI API key (if using openai provider) | - |
| `LLM_MODEL` | Chat completion model | `gpt-4o-mini` |
| `EMBEDDING_MODEL` | Embedding model | `text-embedding-3-small` |
| `X402_MOCK_MODE` | Enable mock payment mode (no real payments) | `false` |
| `X402_NETWORK` | Blockchain network | `cronos-testnet` |
| `X402_ASSET_CONTRACT` | Payment token contract address | - |
| `X402_CHAIN_ID` | Chain ID | `338` |
| `JWT_SECRET` | Secret for JWT tokens (32+ chars) | Required |

### Web (`apps/web/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API server URL | `http://localhost:3001` |
| `NEXT_PUBLIC_X402_NETWORK` | Network name | `cronos-testnet` |
| `NEXT_PUBLIC_X402_CHAIN_ID` | Chain ID | `338` |
| `NEXT_PUBLIC_X402_ASSET_CONTRACT` | Payment token contract address (for balance display) | - |
| `NEXT_PUBLIC_X402_ASSET_DECIMALS` | Payment token decimals | `6` |

## Project Structure

```
/apps
  /web          # Next.js frontend
  /api          # Fastify backend
/packages
  /shared       # Shared types, config, x402 utilities
/infra
  docker-compose.yml
  init-db.sql   # Database schema
```

## API Endpoints

### Public (Marketplace)
- `GET /api/modules` - List/search published modules
- `GET /api/modules/:id` - Get module detail
- `POST /api/modules/:id/chat` - Chat with module (requires payment)

### Seller (Authenticated)
- `POST /api/auth/nonce` - Get SIWE nonce
- `POST /api/auth/verify` - Verify SIWE signature
- `POST /api/seller/modules` - Create module draft
- `POST /api/seller/remix` - Create remix module draft (references upstream + creates agent wallet)
- `POST /api/seller/modules/:id/publish` - Publish module
- `POST /api/seller/modules/:id/qa` - Add Q/A knowledge
- `POST /api/seller/modules/:id/documents` - Add documents
- `GET /api/seller/modules/:id/agent-wallet` - Get remix agent wallet info

## Create Module vs Create Remix

Both flows create a **draft** first — you must **Publish** from the Seller Dashboard for it to show up in `/marketplace`.

### Create Module (Base Module)
Use this when you want a standalone module.

- Creates a new **base** module (`type=base`) with its own persona + knowledge.
- You set:
  - `personaPrompt` (the module’s system prompt)
  - optional knowledge (Q/A and/or documents)
  - pricing (`per_message` or `per_session`) and `payTo` (your revenue address)
- At runtime:
  - Buyer pays the module (x402 `402 → sign → verify/settle → reply`)
  - API runs RAG using **this module’s** knowledge + persona

### Create Remix (Remix / Derivative Module)
Use this when you want to build a derivative that **depends on an upstream module** and pays it automatically.

- Creates a **remix** module (`type=remix`) that references an **upstream published module** (`upstreamModuleId`).
- You set:
  - `deltaPersonaPrompt` (stored as the remix module’s `persona_prompt`)
  - your own pricing + `payTo` (buyer pays you)
- System also creates a server-managed **agent wallet** for the remix.
- At runtime (paid chat):
  1) Buyer pays the remix module (normal x402 flow)
  2) The remix uses its **agent wallet** to pay/call the upstream module
  3) The upstream reply is injected as **UPSTREAM CONTEXT**, then the remix produces the final answer
- Pricing note: the remix pays upstream on each paid call, so your price should be **higher than upstream** (upstream per-session passes aren’t reused yet).
- Funding note: for real on-chain settlement you must fund the remix agent wallet with Cronos Testnet gas + token; in `X402_MOCK_MODE=true`, funding isn’t required.

## Payment Flow

1. Client calls `/api/modules/:id/chat` without payment header
2. Server returns `402 Payment Required` with `paymentRequirements`
3. Client prompts wallet to sign EIP-712 payment authorization
4. Client retries with `X-PAYMENT` header containing signed authorization
5. Server verifies and settles payment via facilitator (relayed on-chain settlement; returns `txHash`)
6. Server executes RAG and returns response

## Local Development with Mock Mode

For local testing without real payments:

```bash
# In apps/api/.env
X402_MOCK_MODE=true
LLM_PROVIDER=mock
```

Mock mode:
- Accepts any valid-looking payment header structure
- Returns mock transaction hashes
- Still enforces the 402 flow for testing

## Deployment

For the full step-by-step guide (Vercel + Railway), see `DEPLOY.md`.

### Docker Deployment

```bash
# Build images
docker build -t soulforge-api ./apps/api
docker build -t soulforge-web ./apps/web

# Run with environment variables
docker run -d -p 3001:3001 --env-file .env soulforge-api
docker run -d -p 3000:3000 --env-file .env soulforge-web
```

### Cloud Deployment

Recommended platforms:
- **API**: Railway, Render, or Fly.io
- **Web**: Vercel or Netlify
- **Database**: Neon, Supabase, or Railway PostgreSQL
- **Redis**: Upstash or Railway Redis

#### Vercel (Web)

This repo is a monorepo. When deploying the Next.js app, set the Vercel project **Root Directory** to `apps/web`.

Recommended Vercel settings:
- **Framework Preset**: Next.js
- **Package Manager**: pnpm (required because `apps/web` depends on `@soulforge/shared` via `workspace:*`)
- **Build Command**: use Vercel default (runs `vercel-build`) or set to `pnpm vercel-build`

Note: deploy the Fastify API separately (it lives in `apps/api`) and point the web app at it via `NEXT_PUBLIC_API_URL`.

Required env vars (set in Vercel Project → Settings → Environment Variables):
- `NEXT_PUBLIC_API_URL` (your deployed API base URL)
- `NEXT_PUBLIC_APP_URL` (your deployed web URL)
- `NEXT_PUBLIC_X402_NETWORK`, `NEXT_PUBLIC_X402_CHAIN_ID`
- `NEXT_PUBLIC_X402_ASSET_CONTRACT` (payment token, used for wallet balance display)

## Demo Script (3 minutes)

1. **Show Marketplace** (30s)
   - Browse modules at `/marketplace`
   - Show search and filtering

2. **Create Module (Base) as Seller** (45s)
   - Go to `/seller`
   - Connect wallet, sign in with SIWE
   - Create module with wizard
   - Add Q/A knowledge
   - Publish module

3. **Create Remix as Seller** (45s)
   - Go to `/seller/remix`
   - Select an upstream published module
   - Write a delta persona + set pricing (higher than upstream)
   - Create remix (agent wallet is generated)
   - (On-chain mode) fund the agent wallet, then Publish

4. **Paid Chat Flow** (45s)
   - Browse to published module
   - Click "Paid Chat"
   - Send message
   - See 402 response
   - Sign payment
   - See successful response with tx hash

5. **Remix Paid Chat (Dual Receipts)** (30s)
   - Chat with a remix module
   - Show buyer payment + upstream payment in UI

6. **Free Preview** (30s)
   - Use "Try Once" feature
   - Show truncated response
   - Show quota exhausted on retry

## License

MIT
