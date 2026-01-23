# Deployment Guide (Vercel + Railway)

This repo is a monorepo:
- **Web (Next.js)**: Vercel, **Root Directory = `apps/web`**
- **Backend (Fastify API + Postgres + Redis)**: Railway

This guide assumes **demo / testnet** usage (no mainnet, no paid API credentials).

---

## 0) Architecture (Recommended)

- **Vercel**
  - `apps/web` (Next.js)
- **Railway**
  - `apps/api` (Fastify)
  - PostgreSQL (**pgvector recommended**)
  - Redis

The web app talks to the Railway API via `NEXT_PUBLIC_API_URL`.

---

## 1) Backend on Railway (API + Postgres + Redis)

### 1.1 Create a Railway project

1. Create a new Railway project.
2. You will add **three services** in the same project:
   - Postgres
   - Redis
   - API

### 1.2 Add Postgres (pgvector recommended)

For best retrieval performance, use the `vector` (pgvector) extension.

The API can also run without pgvector (demo-friendly fallback): it will store embeddings as text and compute cosine similarity in application code. This is slower, but keeps the marketplace usable if pgvector is unavailable.

**Option A (simplest): Railway PostgreSQL plugin**
1. Add a PostgreSQL service/plugin.
2. Connect to the database (Railway UI “Connect” or copy the connection string).
3. Enable extensions (run once):
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "vector";
   ```
4. Initialize schema by running `infra/init-db.sql` against the Railway database.

**Option B (fallback): pgvector Docker image**
If the managed Postgres does not support pgvector in your plan/region, deploy a Postgres service using:
- Image: `pgvector/pgvector:pg16`

Then run `infra/init-db.sql` once against that service.

### 1.3 Add Redis

Add a Redis service/plugin (or a Redis container). The API expects `REDIS_URL`.

### 1.4 Deploy the API service (`apps/api`)

1. Create a new Railway service from this GitHub repo.
2. Set the Railway service **Root Directory** to `apps/api`.
3. Set commands:
   - **Build**: `pnpm build`
   - **Start**: `pnpm start`

Why: `pnpm build` runs a `prebuild` step that builds `@soulforge/shared` (workspace dependency) before running `tsc`.

### 1.5 Environment variables (demo-friendly: file-based)

For Railway demos, the API loads env files in this order:
1. `apps/api/.env` (local dev; usually untracked)
2. `apps/api/.env.railway` (tracked, demo defaults)
3. Railway service variables (highest precedence)

This repo includes a committed file:
- `apps/api/.env.railway`

It intentionally uses:
- `LLM_PROVIDER=mock` (no OpenAI key required)
- `X402_MOCK_MODE=false` by default (toggle to `true` if you want mock payments)
- `AUTO_SEED=true` by default (auto-populates demo modules if DB is empty)

**You still must provide these via Railway services or variables:**
- `DATABASE_URL` (from your Railway Postgres service)
- `REDIS_URL` (from your Railway Redis service)

**Remix modules require:**
- `AGENT_WALLET_ENCRYPTION_KEY` (used to encrypt server-managed remix agent wallets). This is set in `apps/api/.env.railway` for demo; rotate for real deployments.

Railway usually injects these automatically when you attach/link the Postgres/Redis services to the API service.

### 1.6 Make sure the API listens on the right port

Railway sets a `PORT` env var. The API config maps `PORT → API_PORT` automatically, so you typically **do not** need to set `API_PORT` yourself.

### 1.7 Verify health

After deploy, verify:
- `GET /health`
- `GET /health/db` (checks Postgres + pgvector + Redis)
- `GET /health/version` (shows git sha + whether demo seeding ran)

---

## 2) (Optional) Seed demo data into Railway DB

If you want the deployed marketplace to be pre-populated, you have two options:

### Option A: Automatic (recommended for demos)
Set `AUTO_SEED=true` (default in `apps/api/.env.railway`). On startup, if there are **no published modules**, the API will run the seed script once.

### Option B: Manual (from your local machine)
Seed your Railway database from your local machine:

1. Copy `DATABASE_URL` and `REDIS_URL` from Railway.
2. From repo root:
   ```bash
   DATABASE_URL="..." REDIS_URL="..." pnpm --filter api seed:local
   ```

If you run the command from `apps/api` instead, the script will also load `apps/api/.env.railway` automatically.

---

## 3) Web on Vercel (points to Railway API)

Deploy the web app on Vercel:
- **Root Directory**: `apps/web`
- Set env vars:
  - `NEXT_PUBLIC_API_URL` = your Railway API public URL
  - `NEXT_PUBLIC_APP_URL` = your Vercel URL
  - `NEXT_PUBLIC_X402_NETWORK`, `NEXT_PUBLIC_X402_CHAIN_ID`
  - `NEXT_PUBLIC_X402_ASSET_CONTRACT` (used for balance display)

Note: `apps/web/package.json` includes a `vercel-build` script that builds `@soulforge/shared` before running `next build`.

See `README.md` for Vercel notes.
