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

- **Upstream PR: https://github.com/akash-network/console/pull/3460** (head `opencolin:feat/x402-integration`, base `akash-network:main`).

- **Review candidate: `feat/x402-integration`** at
  `/Users/colin/Code/console-worktrees/x402-integration` — the single integrated branch that merges
  all four verified release branches (v1.0 readback/on-ramp, v1.1 money-integrity gate, v1.2
  sandbox/discovery, v2.0 pay-per-deploy) on top of the v1.0 core. This is the branch to review and,
  once approved, land. Base of each release remains `feat/x402-usdc-topup` (v1.0 core).
- Merge order used: base `feat/x402-v2-0-pay-per-deploy` (already contains v1.1 + core), then
  `git merge feat/x402-v1-0-readback-and-onramp`, then `git merge feat/x402-v1-2-sandbox-and-discovery`.
  Conflicts were resolved semantically so every feature works together.
- Endpoints now available on the integrated branch (all on `x402Router`, registered via
  `src/routers/open-api-handlers.ts`):
  - `POST /v1/x402/top-up?amount=<usd>` (`createUsdcTopUp`) — x402-gated wallet top-up.
  - `GET /v1/x402/transactions` (`listUsdcTopUps`) — paginated, IDOR-safe read-back of the caller's
    own x402 transactions (v1.0).
  - `GET /v1/x402/discovery` (`listPayableResources`, public `SECURITY_NONE`) — canonical discovery
    document; derived from `X402Service.getCanonicalRoutes()`, the same single source the 402 flow
    uses, so it advertises both `POST /v1/x402/top-up` **and** `POST /v1/x402/deploy` (v1.2 + v2.0).
  - `POST /v1/x402/deploy` (`createUsdcDeployment`) — pay-per-deploy: one x402-paid call settles,
    credits, then creates a funded deployment; partial-failure returns 502
    `DEPLOY_FAILED_FUNDS_CREDITED` with funds left spendable (v2.0).
  - Reconcile job (`x402-reconcile-settled`, seeded in `src/app/providers/jobs.provider.ts`) —
    re-drives crediting for any `settled`-but-uncredited transaction (v1.1).
- Money-integrity flow on `x402.service.ts`: settle-before-credit → v1.1 conditional
  `settled→succeeded` transition (`markSettledAsSucceeded`, exactly-once) → `payment_hash`
  unique-violation handling → v1.2 pre-settle guardrails (`validatePreSettle`:
  `WRONG_NETWORK`/`WRONG_ASSET`/`AMOUNT_MISMATCH` before settlement) → v2.0 pay-per-deploy path +
  per-user rate/cost abuse controls. All error codes unified in
  `apps/api/src/billing/services/x402/x402-error-codes.ts` and used by controller, service, router.
- Migrations sequential: `0032_melodic_onslaught.sql` (v1.0 core table) + `0033_x402_deploy_columns.sql`
  (v2.0 `deployment_dseq`/`deploy_failed` columns); `_journal.json` in sync (no renumber needed —
  v1.0/v1.1/v1.2 added no migration).
- Verification on the integrated branch: `npx tsc -p tsconfig.build.json --noEmit` clean; eslint
  `--quiet` clean on all touched x402/billing/config dirs; all x402 + `env.config` unit specs green.

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
