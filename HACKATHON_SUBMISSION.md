# Cronos x402 Paytech Hackathon — SoulForge

## One‑liner
SoulForge is a marketplace where **AI personas + knowledge modules** are sold as **paywalled API capabilities**—unlocked instantly via **x402 (HTTP 402 Payment Required)** wallet payments.

## The Problem
Creators can build high-value AI personas and knowledge bases, but today:
- **Pay‑per‑use monetization is painful**: subscriptions, logins, and credit cards add friction (especially for “one question” use).
- **APIs don’t have a native payment handshake**: “pay before compute” is bolted on with custom paywalls.
- **Derivatives break incentives**: remix/derivative agents can capture value without automatically compensating originals.

## The Solution (What We Built)
SoulForge makes AI capabilities purchasable like an API call:
- **Marketplace UX**: creators publish modules (persona + knowledge + price); buyers browse and discover.
- **Try‑once preview**: buyers can sample a module before paying (limited preview).
- **x402 paywall**: a paid chat request triggers `402` → wallet “Pay & Send” → full response.
- **On‑chain receipts**: each payment returns a `txHash` shown in the UI for verifiable settlement.

## Why x402 Matters Here
AI usage is naturally **per‑request** (a prompt is an API call). x402 turns that into a standard-shaped flow:
- **No accounts required**: the wallet is the identity and the payment instrument.
- **Built for automation**: it works for humans *and* for agents (machine‑to‑machine payments).
- **Enforces “pay before answer”**: the server returns content only after payment is verified/settled.

## Why Cronos EVM + On‑Chain Settlement
We use on‑chain settlement to make payments **verifiable** and **composable**:
- **Receipts you can audit**: a `txHash` proves the payment happened (and can be shown in the product).
- **Composable economics**: agent‑to‑agent payments enable Remix modules to pay upstream automatically.
- **Cronos EVM**: EVM‑compatible network with wallet tooling and testnet stablecoin (`devUSDC.e`) that fits micropayments.

## Key Differentiator: Remix Economics (Derivative‑Pays‑Original)
SoulForge supports **Remix modules**: a derivative module composes an upstream module at runtime **without copying data**.

When a buyer uses a Remix module, one request can produce **two settlement receipts**:
1) **Buyer → Remix creator** (the module they chose)
2) **Remix agent wallet → Upstream creator** (the original capability it depends on)

The UI shows both receipts, proving that **derivatives can automatically generate revenue for originals**.

## Who It’s For
- **AI creators**: monetize personas/knowledge without building subscriptions or billing.
- **Product builders**: buy capabilities as APIs (pay only when they’re used).
- **Agent developers**: compose paid modules with upstream payments baked in.

## Demo (What Judges Should See)
1) Browse the marketplace and open a module detail page.
2) Use **Try Once** to show a limited preview.
3) Click **Paid Chat** and send a message:
   - first request returns **402 Payment Required**
   - wallet prompts to authorize payment
   - retry returns the full AI response
4) Point out the **on‑chain `txHash`** displayed in the chat UI.
5) Repeat the paid chat with a **Remix module** and show **two payment receipts** (buyer + upstream).

## Tracks (Recommended)
- Main Track — x402 Applications (Broad Use Cases)
- x402 Agentic Finance/Payment Track — Agent‑to‑agent upstream payments (Remix)

## Links
- GitHub Repo: <YOUR_GITHUB_REPO_URL>
- Demo Video: <YOUR_DEMO_VIDEO_URL>
- Deployed Prototype (Web, Vercel): https://www.soulforgemarket.xyz/ (Vercel Root Directory: `apps/web`)
- Deployed Prototype (API, Railway): https://api.soulforgemarket.xyz/

## What’s Next (After Hackathon)
- **Session passes**: reduce repeat signing for frequent users.
- **Creator analytics**: conversion + revenue insights for pricing iteration.
- **Royalties**: richer on‑chain splits and cross‑module revenue graphs.

## Quick Verification (Minimal Technical Info)
- Network: Cronos EVM (Testnet by default, `chainId=338`)
- Pay token: devUSDC.e (`X402_ASSET_CONTRACT`)
- Local demo: `pnpm demo` (mock payments) or `pnpm demo:onchain` (testnet settlement)
- Runbook: `DEMO_RUNBOOK.md`
