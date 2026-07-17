# x402 v2.0 — Pay-per-deploy

Branch: `feat/x402-v2-0-pay-per-deploy` (off `feat/x402-v1-1-money-integrity-gate`)

## Goal

One x402-paid call creates **and** funds an Akash deployment with zero prior Console balance. Funds
can never strand: settlement → credit runs through the same money-integrity gate as top-ups, and if
deployment creation fails the money stays spendable in the Console balance (no on-chain reversal).

## What shipped

### New endpoint: `POST /v1/x402/deploy`

Added to the existing `x402Router` (`apps/api/src/billing/routes/x402/x402.router.ts`), operationId
`createUsdcDeployment`. Body `{ sdl, deposit }` — the same shape as `POST /v1/deployments`, where
`deposit` (USD) is both the amount paid via x402 and the deployment funding amount.

Flow (`X402Service.processDeploy`, `apps/api/src/billing/services/x402/x402.service.ts`):

1. `processHTTPRequest` verifies the payment (402 + requirements when no `X-PAYMENT`). The x402 price
   for the route is derived from the request body's `deposit` (`parseDeposit`, reads `adapter.getBody`).
2. **Abuse controls** run on the verified request, before settlement (see below); an over-limit caller
   has their verified payment cancelled and nothing is captured.
3. `settlePaymentAndCredit` — the settle-before-credit path extracted and now shared with `processTopUp`:
   settle on-chain, persist `settled`, then credit via `creditSettledTransaction` →
   `RefillService.topUpWallet`. This is the **only** funding path; there is no bespoke credit.
4. Drive the existing managed deployment creation service — `DeploymentWriterService.create`, the same
   service `DeploymentController.create` uses — with the freshly credited balance.
5. On success: link `deploymentDseq` on the row, return `200` with `{ deploymentDseq, manifest, signTx, … }`.

### Partial-failure fallback (item 3)

If settlement + credit succeed but `DeploymentWriterService.create` throws, the funds remain credited.
The row is flagged (`deployFailed = true`, error note stored) and the endpoint returns **HTTP 502**
with code `DEPLOY_FAILED_FUNDS_CREDITED`, telling the caller the money is in their Console balance and
to retry via `POST /v1/deployments`. No on-chain reversal is ever attempted.

### Schema + migration (item 2)

`x402_transactions` gains two nullable/defaulted columns
(`apps/api/src/billing/model-schemas/x402-transaction/x402-transaction.schema.ts`):

- `deployment_dseq varchar(100)` — dseq of the deployment funded by the payment (null for top-ups).
- `deploy_failed boolean NOT NULL DEFAULT false` — set when a paid+credited deployment failed.

Migration: `apps/api/drizzle/0033_x402_deploy_columns.sql` (generated via `drizzle-kit generate`).

### Abuse controls (item 4)

Config-driven, per-user, evaluated against recent (non-failed) `x402_transactions` — no new infra
(`env.config.ts`, repository `countByUserSince` / `sumAmountByUserSince`):

- `X402_ABUSE_WINDOW_SECONDS` (default 3600) — rolling window.
- `X402_ABUSE_MAX_REQUESTS` (default 10) — request-count rate limit → `429` + `Retry-After`.
- `X402_ABUSE_MAX_SPEND_USD` (default 2000) — cumulative-spend cost ceiling → `402`.
- `X402_MIN_DEPLOY_USD` / `X402_MAX_DEPLOY_USD` (default 1 / 1000) — per-request deposit bounds.

Auth parity: `X402Controller.deploy` is `@Protected([{ sign UserWallet }, { create X402Payment }])`.
`sign UserWallet` is the exact ability `DeploymentController.create` requires, and the CASL ability set
is identical for bearer and api-key auth (`AbilityService` is role-based, not auth-method-based), so the
api-key path cannot bypass wallet-signing authorization.

No first-purchase/trial bonus on x402 credits: `topUpWallet` is called with only
`{ payment: { currency, paymentMethodType: "x402", transactionId } }` — no bonus, asserted in specs.

## Tests

`apps/api/src/billing/services/x402/x402.service.spec.ts` (mocked facilitator + mocked
`DeploymentWriterService`), all green — 20 tests total, 6 new for deploy:

- paid-create success links `deploymentDseq`, credits once through `topUpWallet`, drives deploy service.
- paid-but-deploy-failed leaves funds credited (topUpWallet called once) and flags the row via
  `markDeployFailed`; returns `deploy-failed`.
- rate limit and cost ceiling each reject before settlement (no `processSettlement`, no `topUpWallet`,
  verified payment cancelled).
- duplicate payment → `duplicate-payment`; no-payment → `payment-required`.

## Verification run

- `npx tsc -p tsconfig.build.json --noEmit` — clean.
- `npx eslint <touched x402 dirs> --quiet` — clean.
- `npx vitest run --project=unit src/billing/services/x402/x402.service.spec.ts` — 20 passed.

Note: `npx tsc --noEmit` on the full (non-build) tsconfig reports two PRE-EXISTING errors in files this
branch did not touch (`x402-reconcile-settled.handler.spec.ts`, `github-archive.service.spec.ts`).

## Left for manual/follow-up

- Real dogfooding needs a funded testnet wallet + live facilitator; implemented and unit-tested here,
  but an end-to-end paid deploy against Base/testnet is a manual step.
- Optional: apply the same abuse-control guard to `POST /v1/x402/top-up` (currently deploy-only; the
  shared helper makes this a small addition if desired).
