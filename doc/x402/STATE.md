# x402 Integration — Live State (agent handoff)

> Updated by whichever agent finishes a work item. Read this first, then [PLAN.md](./PLAN.md).

## What this project is

Add x402 (HTTP 402 crypto payment protocol, v2, `@x402/*` SDK 2.19.0) support to Akash Console so
users and AI agents can fund Console credits and deployments with USDC instead of a credit card.
The Console API docs list "Payment method: credit card only" as a limitation — this removes it.

Repo layout facts that matter (verified against this codebase):

- Console "credits" are an on-chain `DepositAuthorization` grant from a master funding wallet to a
  per-user derived wallet. `RefillService.topUpWallet(amountUsdCents, userId)`
  ([refill.service.ts](../../apps/api/src/billing/services/refill/refill.service.ts)) is the single
  choke point that converts "money received" into spendable credits. Stripe's webhook is the only
  existing caller. x402 slots in as a second payment source ending in the same call.
- `apps/api` is Hono + `@hono/zod-openapi` + tsyringe. New modules follow the `billing/` pattern:
  model-schemas (drizzle) → repositories → services → controllers → routes, registered in
  `src/routers/open-api-handlers.ts`.
- Auth: `Authorization: Bearer` or `x-api-key`; CASL abilities in
  `src/auth/services/ability/ability.service.ts` (an `X402Payment` subject was added).
- Console Air (github.com/akash-network/console-air) is frontend-only (self-custody UI); the x402
  server integration lives here in `console`, which Console Air instances can also point at.

## Current status

- Branch: `feat/x402-usdc-topup` (branched from upstream `main`, shallow clone at
  `/Users/colin/Code/console`)
- Implemented (v1 core, done):
  - `POST /v1/x402/top-up?amount=<usd>` — x402-gated top-up. No `X-PAYMENT` header → 402 with
    payment requirements; signed retry → facilitator verify → settle → credit via
    `RefillService.topUpWallet`. Files:
    - `apps/api/src/billing/services/x402/x402.service.ts` (flow; settle-before-credit, idempotent
      by sha256 of payment payload, crash-recovery via `settled` status resume)
    - `apps/api/src/billing/services/x402/x402-http-server-factory.service.ts`
    - `apps/api/src/billing/controllers/x402/x402.controller.ts` (`@Protected` X402Payment)
    - `apps/api/src/billing/routes/x402/x402.router.ts` (operationId `createUsdcTopUp`)
    - `apps/api/src/billing/model-schemas/x402-transaction/…` + repository + migration
      `apps/api/drizzle/0032_melodic_onslaught.sql`
    - env config: `X402_ENABLED`, `X402_PAY_TO_ADDRESS`, `X402_NETWORK` (CAIP-2, default
      `eip155:8453` Base), `X402_FACILITATOR_URL` (default `https://x402.org/facilitator`),
      `X402_MIN_TOP_UP_USD`, `X402_MAX_TOP_UP_USD`
  - Unit tests: `x402.service.spec.ts` — 7 passing (`npx vitest run --project=unit src/billing/services/x402/x402.service.spec.ts`)
  - `npx tsc -p tsconfig.build.json --noEmit` clean; eslint clean on touched files.
- Not yet done: see PLAN.md release scopes.

## Conventions the next agent must follow

- Read `/Users/colin/Code/console/CLAUDE.md` before writing code (strict TS, tsyringe DI,
  `createRoute` + `OpenApiHonoHandler`, `*.spec.ts` colocated, `mock<T>()` from
  vitest-mock-extended, `setup()` instead of `beforeEach`, LoggerService not console.log,
  conventional commits, before push: `npm test`, `npm run lint -- --quiet`, `npx tsc --noEmit`).
- `@WithTransaction` methods resolve `TxService` from the global container — unit tests must
  `container.registerInstance(TxService, mock)` (see `x402.service.spec.ts`).
- Worktrees for parallel release work: `git -C /Users/colin/Code/console worktree add
  /Users/colin/Code/console-worktrees/<branch> -b <branch> feat/x402-usdc-topup`.
- Do NOT push or open PRs without the user's say-so.

## Key external references

- x402 spec/SDK: github.com/x402-foundation/x402 (`@x402/core`, `@x402/evm`, `@x402/hono` — all 2.19.0)
- Server flow used: `x402HTTPResourceServer.processHTTPRequest` → `processSettlement`
  (deliberately settle-before-credit, unlike middleware's settle-after-response, because crediting
  is irreversible)
- Console API docs: https://akash.network/docs/api-documentation/console-api/getting-started/
