# x402 Integration — Release Plan (through v2)

> Owner process: a "PM council" workflow (multiple PM-persona agents + synthesis) decides scope per
> release; implementation fans out as workflows in git worktrees. This file records the decided
> plan. Status legend: ☐ planned · ◐ in progress · ☑ done.

## Draft roadmap (pre-council; council output will replace this section)

- **v1.0 — USDC top-up (core)** ◐
  - x402-gated `POST /v1/x402/top-up` (done, see STATE.md)
  - `GET /v1/x402/transactions` listing endpoint
  - Example agent client script (`@x402/fetch` + x-api-key): top up → deploy → close
  - `doc/x402-payments.md` operator + user docs; env samples updated
- **v1.1 — Productionization**
  - Functional/integration tests (mock facilitator)
  - Reconciliation job for `settled`-but-uncredited transactions (pg-boss)
  - Multi-network accepts (Base + Base Sepolia for sandbox; optional Solana via `@x402/svm`)
- **v1.5 — Surfaces**
  - deploy-web: "Pay with USDC" flow in Top Up UI (x402 paywall or wallet connect)
  - Auto-reload via x402 (wallet-settings parity with Stripe auto-reload)
- **v2.0 — Agent-native payments**
  - Pay-per-deploy: single x402-paid call that creates+funds a deployment (no prior balance)
  - x402-paid deposit-deployment (top up a specific deployment's escrow directly)
  - OpenAPI/Bazaar discovery metadata so x402-aware agents can find the endpoints

## Council decision log

_(appended by the council workflow)_

## Worktree / branch map

| Release | Branch | Worktree | Status |
|---|---|---|---|
| v1.0 core | `feat/x402-usdc-topup` | main checkout `/Users/colin/Code/console` | ◐ |
| v1.0 readback + on-ramp | `feat/x402-v1-0-readback-and-onramp` | `/Users/colin/Code/console-worktrees/x402-v1-0` | ☑ |
| v1.1 money-integrity gate | `feat/x402-v1-1-money-integrity-gate` | `/Users/colin/Code/console-worktrees/x402-v1-1` | ☑ |
| v1.2 sandbox + discovery | `feat/x402-v1-2-sandbox-and-discovery` | `/Users/colin/Code/console-worktrees/x402-v1-2` | ☑ |
| v2.0 pay-per-deploy | `feat/x402-v2-0-pay-per-deploy` | `/Users/colin/Code/console-worktrees/x402-v2-0` | ☑ |
| Integration (v1.0+v1.1+v1.2+v2.0) | `feat/x402-integration` | `/Users/colin/Code/console-worktrees/x402-integration` | ☑ |

## Handoff instructions

1. Read [STATE.md](./STATE.md) for what exists and repo conventions.
2. Claim a release: add a row above with your worktree path before starting.
3. Base new branches on `feat/x402-usdc-topup` (until it merges), one worktree per release:
   `git -C /Users/colin/Code/console worktree add /Users/colin/Code/console-worktrees/<branch> -b <branch> feat/x402-usdc-topup`
4. Definition of done per release: typecheck + lint + unit tests green in the worktree, docs
   updated, STATE.md and this table updated, commits use conventional commits. No pushes/PRs
   without user approval.
