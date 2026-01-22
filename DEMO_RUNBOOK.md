# SoulForge Demo Runbook

A step-by-step guide to demonstrate SoulForge in 3 minutes.

## Quick Start (One Command Demo)

The fastest way to get a working demo:

```bash
# One command to start everything with seeded data
pnpm demo
```

Deployment note: the web app is a Next.js project under `apps/web` and is intended to be deployed on Vercel with the Vercel project Root Directory set to `apps/web` (see `README.md`).
Backend deployment note: for a hosted demo, deploy the API + Postgres + Redis on Railway (see `DEPLOY.md`).

This will:
1. Start Docker infrastructure (Postgres, Redis)
2. Wait for the database to be ready
3. Seed the marketplace with 9 demo modules (8 base + 1 remix)
4. Start web and API in demo mode with mock payments

Open http://localhost:3000 to see the marketplace with pre-populated modules.

**Note**: Demo mode shows a purple banner at the top indicating mock mode is active.

### Quick Start (On-Chain Settlement)

To demo real on-chain settlement on Cronos Testnet (required for hackathon submission), run:

```bash
# Starts infra + seeded data, but uses the real x402 facilitator (no mock)
pnpm demo:onchain
```

Prereqs:
- `apps/api/.env` must have a valid `X402_FACILITATOR_BASE_URL` (the script forces `X402_MOCK_MODE=false`)
- Your wallet must hold devUSDC.e on Cronos Testnet (for payments)

---

## Pre-Demo Setup (Manual Method)

### 1. Environment Setup

```bash
# Start infrastructure
cd infra && docker compose up -d

# Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Enable mock mode for demo (no real payments)
# In apps/api/.env:
X402_MOCK_MODE=true
LLM_PROVIDER=mock  # or openai for real responses

# Seed the marketplace with demo modules
pnpm seed

# Start services
pnpm dev
```

### 2. Wallet Setup

You need a browser wallet (MetaMask recommended):

1. Install MetaMask extension
2. Create or import a wallet
3. Add Cronos Testnet:
   - Network Name: Cronos Testnet
   - RPC URL: https://evm-t3.cronos.org
   - Chain ID: 338
   - Currency Symbol: tCRO
   - Block Explorer: https://explorer.cronos.org/testnet

**For real demo (not mock mode):**
- Get testnet tCRO for gas
- Mint devUSDC.e (payment token):
  - https://faucet.cronos.org

### 3. Pre-Create Demo Module (Optional)

Create a module before demo to save time:

1. Go to http://localhost:3000/seller
2. Connect wallet
3. Sign in with Ethereum
4. Create module:
   - Name: "RPG Merchant NPC"
   - Description: "A wise merchant who sells magical items and shares tales from distant lands"
   - Tags: `rpg, npc, fantasy`
   - Persona: "You are Grimwald the Merchant, a seasoned trader who has traveled across many realms. You speak with wisdom and occasional mystery. You know about magical items, potions, and rare artifacts."
   - Add Q/A:
     - Q: "What items do you have for sale?"
     - A: "Ah, a customer! I have healing potions for 10 gold, enchanted daggers for 50 gold, and a mysterious amulet that grants night vision - only 200 gold! Each item comes with my personal guarantee."
     - Q: "Tell me about yourself"
     - A: "I am Grimwald, merchant of the Azure Crossroads. I've traded in kingdoms you've never heard of and seen wonders that would make your head spin. But enough about me - are you here to buy, sell, or just chat?"
   - Price: $0.01 per message
5. Publish the module

---

## Demo Script (3 Minutes)

### Opening (15 seconds)
> "SoulForge is an AI module marketplace where creators can monetize their AI personas and knowledge bases using cryptocurrency micropayments."

### Part 1: Show Marketplace (30 seconds)

1. Open http://localhost:3000/marketplace
2. Point out:
   - Grid of available AI modules
   - Search and filter functionality
   - Pricing displayed on cards
   - Eval scores (when available)

> "This is our marketplace where users can discover AI modules. Each module has custom knowledge and personality, with transparent pricing."

### Part 2: Module Detail (15 seconds)

1. Click on a published module
2. Show:
   - Full description and tags
   - Pricing information
   - "Try Once" and "Paid Chat" buttons
   - Example prompts

> "Each module shows its capabilities, pricing, and example questions. Users can try once for free or pay for full access."

### Part 3: Free Preview (30 seconds)

1. Click "Try Once (Free)"
2. Send a message: "What items do you have?"
3. Show truncated response with preview notice

> "The free preview gives a taste of the module's capabilities. Notice the response is truncated - this encourages users to pay for full access."

### Part 4: Paid Chat Flow - THE KEY DEMO (1 minute)

1. Click "Paid Chat"
2. Type a message: "Tell me about your best magical item"
3. **Show 402 response** - "Payment Required" modal appears
4. Point out:
   - Price displayed
   - Network information
   - Wallet connection option

> "When you send a message, the server returns a 402 Payment Required status. This is the x402 protocol in action."

5. Connect wallet (if not connected)
6. Click "Pay & Send"
7. **Sign the EIP-712 payment authorization** in MetaMask (the facilitator relays the on-chain settlement)
8. **Show successful response**

> "After signing the payment authorization, the server verifies and settles the payment, then returns the full AI response."

9. Point out the payment confirmation banner:
   - Transaction hash
   - Amount paid

> "Every payment is recorded on-chain and visible to the user. This creates a transparent marketplace."

### Part 5: Seller Dashboard (30 seconds)

1. Go to http://localhost:3000/seller
2. Show:
   - List of created modules
   - Module status (draft/published)
   - Link to create new module

> "Sellers can easily create and manage their AI modules through this dashboard. The wizard guides them through persona definition, knowledge base creation, and pricing setup."

### Closing (15 seconds)
> "SoulForge enables a new economy for AI creators. Anyone can monetize their expertise through paywalled AI modules, with instant cryptocurrency payments and transparent pricing."

---

## Troubleshooting

### "Module not found"
- Ensure the module is published (status: published)
- Check module ID in URL

### "Payment verification failed"
- In mock mode, ensure payment header is valid JSON base64
- Check browser console for errors

### "Wallet not connecting"
- Refresh page
- Check MetaMask is unlocked
- Try disconnecting and reconnecting

### "No response from API"
- Check API is running: `curl http://localhost:3001/health`
- Check logs: `pnpm --filter api dev`

### "Database errors"
- Check Docker is running: `docker ps`
- Restart: `cd infra && docker compose restart`

---

## Demo Variations

### Short Demo (1 minute)
1. Show marketplace
2. Show 402 payment modal
3. Complete one paid chat

### Technical Demo (5 minutes)
Include:
- Show API endpoints in browser dev tools
- Show payment header structure
- Demonstrate mock vs real mode
- Show database records

### Seller-Focused Demo (3 minutes)
1. Create module from scratch
2. Add knowledge base
3. Publish and test

---

## Key Talking Points

1. **x402 Protocol**: HTTP 402 status code for payment-gated content
2. **Instant Micropayments**: Pay per message, no subscriptions
3. **Creator Economy**: Anyone can monetize AI expertise
4. **Transparent Pricing**: All prices visible upfront
5. **RAG-Powered**: Custom knowledge bases enhance responses
6. **Web3 Native**: Wallet-based auth and payments

---

## Seeded Demo Modules

When using `pnpm demo`, the following modules are automatically created:

### Featured Modules (shown first)
- **Local Demo Module** - Basic demo module ($0.01/msg)
- **RPG Merchant NPC** - Fantasy merchant character ($0.01/msg)

### Base Modules
- **PRD Coach** - Product requirements expert ($0.015/msg)
- **On-Call Helper** - Incident response assistant ($0.05/session)
- **Code Reviewer** - Senior engineer code review ($0.02/msg)
- **Fitness Coach** - Personal trainer ($0.03/session)
- **Writing Assistant** - Professional editor ($0.012/msg)
- **SQL Query Expert** - Database expert ($0.018/msg)

### Remix Modules
- **Scammy Merchant** - A humorous remix of RPG Merchant ($0.015/msg)
  - Demonstrates the remix feature where derivatives pay upstream

#### What “Remix” Means in SoulForge
Remix modules are **derivative modules** that compose an upstream module at runtime:
- A remix references an **upstream published module** (`upstreamModuleId`).
- The remix has its own pricing + `payTo` (buyer pays the remix creator).
- On each paid call, the remix server:
  1) pays/calls the upstream module using a server-managed **agent wallet**
  2) injects the upstream reply as **UPSTREAM CONTEXT**
  3) generates the final response using the remix’s own persona + knowledge

Key property: the remix does **not** copy upstream knowledge into its own DB — it calls upstream live and pays for it.

#### Demo Tip (Dual Receipts)
When chatting with a remix module, point out that the UI can show two payment events:
1) **Buyer → Remix**
2) **Remix agent wallet → Upstream**

Funding note:
- In `X402_MOCK_MODE=true` (default for `pnpm demo`), payments are mocked, so agent wallet funding is not required.
- In on-chain mode, fund the agent wallet with Cronos Testnet gas + token so it can pay upstream.

All modules have:
- Eval scores (6-9 out of 10)
- Knowledge bases with Q/A pairs
- Realistic personas and descriptions
- Various pricing modes (per-message and per-session)

---

## Environment Variables for Demo Mode

| Variable | Value | Description |
|----------|-------|-------------|
| `DEMO_MODE` | `true` | Enables demo defaults in API |
| `X402_MOCK_MODE` | `true` | Bypasses real payment verification |
| `LLM_PROVIDER` | `mock` | Uses deterministic mock responses |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Shows demo banner in web UI |

These are automatically set when using `pnpm demo`.
