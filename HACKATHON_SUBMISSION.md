# Cronos x402 Paytech Hackathon — Submission Draft

## Project Overview (1–2 paragraphs)
SoulForge is an AI persona + knowledge module marketplace where creators monetize agent capabilities via paywalled API access. Buyers discover modules in a marketplace UI, try a limited free preview, then unlock full responses using an **x402-style HTTP 402 Payment Required** flow that turns a chat request into a programmatic payment + response.

SoulForge also supports **Remix (derivative) modules**: a remix module can call an upstream module at runtime (no data copying) and automatically pay upstream via an **agent wallet**, proving “derivatives generate revenue for originals” using on-chain settlement and transparent payment events (tx hash) for both buyer→remix and remix→upstream.

## On-Chain Component (Cronos EVM + x402-compatible flow)
- Network: Cronos EVM (Testnet by default, `chainId=338`)
- Pay token: devUSDC.e (`X402_ASSET_CONTRACT`)
- Flow:
  1) Client calls a paid endpoint without `X-PAYMENT` → server returns `402` + `paymentRequirements`
  2) Client signs an EIP-712 payment authorization (gasless signature prompt)
  3) Client retries with `X-PAYMENT` header (base64 payload)
  4) Server verifies + settles via x402 facilitator (`/verify`, `/settle`)
  5) Settlement produces an on-chain tx hash (`txHash`), which is stored and displayed in the UI
- Remix proof: one buyer request can create **two** on-chain settlement events (buyer→remix, remix-agent→upstream).

## Tracks (recommended)
- Main Track — x402 Applications (Broad Use Cases)
- x402 Agentic Finance/Payment Track — Agent-to-agent upstream payments (Remix)

## Links (fill these in)
- GitHub Repo: <YOUR_GITHUB_REPO_URL>
- Demo Video: <YOUR_DEMO_VIDEO_URL>
- Deployed Prototype (Web, Vercel): <YOUR_WEB_URL> (Vercel Root Directory: `apps/web`)
- Deployed Prototype (API, Railway): <YOUR_API_URL>

## Demo Video Checklist (suggested shots)
1) Marketplace: browse modules + open a module detail page.
2) Paid chat attempt: show `402 Payment Required` modal + payment requirements (network/amount).
3) Wallet action: sign the EIP-712 payment authorization.
4) Confirmation: show `txHash` displayed in chat UI, then open Cronos Explorer to prove on-chain settlement.
5) Remix module: run a paid chat on a Remix module and show two payment banners:
   - Payment Confirmed (buyer→remix)
   - Upstream Payment (remix→upstream)

## How to Run (Local)
### A) Fast local demo (mock payments; no on-chain)
```bash
pnpm demo
```

### B) On-chain demo (Cronos Testnet settlement)
1) Configure env:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

2) In `apps/api/.env` set:
- `X402_MOCK_MODE=false` (or run `pnpm demo:onchain`, which forces it off)
- `X402_FACILITATOR_BASE_URL=...` (Cronos x402 facilitator base URL)
- `X402_NETWORK=cronos-testnet`
- `X402_CHAIN_ID=338`
- `X402_ASSET_CONTRACT=<devUSDC.e contract>`

3) Run:
```bash
pnpm demo:onchain
```

4) Wallet setup:
- Add Cronos Testnet (RPC: https://evm-t3.cronos.org, Chain ID: 338)
- Get devUSDC.e from the faucet: https://faucet.cronos.org

## Notes
- In on-chain mode, users **sign** the payment authorization in the wallet; the on-chain settlement is **relayed** by the facilitator and returns a transaction hash.
