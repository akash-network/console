# x402 v1.1 — Money-integrity gate

Guarantees that a settled x402 payment is credited to a user's Console wallet **exactly once**, and
that no USDC is ever left stranded (settled on-chain but never credited). Purely additive on top of
the v1 core top-up flow.

## What shipped

### 1. Double-credit race guard (conditional transition)

`X402Service.creditSettledTransaction` now credits through an atomic DB transition instead of an
unconditional status write:

- New repo method `X402TransactionRepository.markSettledAsSucceeded(id)` runs
  `UPDATE x402_transactions SET status = 'succeeded', updated_at = now() WHERE id = $1 AND status = 'settled'`
  and returns `true` only when it affected a row (rowCount 1).
- `creditSettledTransaction` calls `refillService.topUpWallet` **only** when the transition won
  (returns `true`); it now returns a boolean so callers can tell a real credit from a no-op.
- Result: a concurrent request retry and the reconcile job can both drive the same `settled` row and
  the wallet is topped up once. The row is still `SELECT ... FOR UPDATE` locked first, so the
  conditional update is the primary gate with row-lock serialization as defense in depth.

### 2. Reconciliation job (`x402-reconcile-settled`)

A recurring pg-boss job that re-drives crediting for any transaction stranded in `settled` past a
configurable threshold (default 5 min), covering the crash-before-credit window.

- `X402Service.reconcileStaleSettled()` scans stale `settled` rows via
  `X402TransactionRepository.findStaleSettled(cutoff, batchSize)` (oldest first), logs an
  `X402_RECONCILE_BACKLOG` count each run, re-drives each through the idempotent credit path, and
  logs `X402_RECONCILE_COMPLETED` with `{ backlog, credited, failed }`. A single row's failure is
  logged and counted without aborting the batch.
- `X402ReconcileSettledHandler` implements `JobHandler` (queue `x402-reconcile-settled`,
  `policy: "singleton"`, `concurrency: 1`), mirroring `WalletBalanceReloadCheckHandler`. It runs a
  pass then self-reschedules the next run in a `finally` so the loop survives a throwing pass.
- `X402ReconcileJobService` seeds/reschedules the job (cancel-created-then-enqueue with a
  `singletonKey`, mirroring `WalletReloadJobService`). Registered + seeded in
  `src/app/providers/jobs.provider.ts` next to the other handlers; seeding is a no-op when x402 is
  disabled.

### 3. `payment_hash` unique-violation handling

Migration 0032's `x402_transactions_payment_hash_unique` is a real DB-level `UNIQUE INDEX` (verified
in the migration SQL and the drizzle model-schema). `processTopUp` now catches the unique violation
on insert (via `isUniqueViolation` from `base.repository`) instead of 500ing:

- On conflict it re-reads the winning row by `payment_hash` and routes through the same
  terminal/settled resolution: `succeeded` → 409 duplicate, `settled` → resume credit (success),
  in-flight `pending`/`failed` → 409 duplicate (the concurrent request or the reconcile job will
  credit; nothing settled means nothing stranded).
- Non-unique-violation insert errors still propagate.

## Config added (`apps/api/src/billing/config/env.config.ts`)

- `X402_RECONCILE_THRESHOLD_SECONDS` (default `300`) — age a `settled` row must reach before the job
  reconciles it (keeps the job from racing in-request crediting of a fresh settlement).
- `X402_RECONCILE_INTERVAL_SECONDS` (default `300`) — reconcile scan cadence.
- `X402_RECONCILE_BATCH_SIZE` (default `100`) — max stale rows reconciled per run.

## Tests (unit project, all green — 21 in `x402.service.spec.ts` + handler + scheduler specs)

- `x402.service.spec.ts`
  - crash-before-credit then reconcile credits exactly once (second reconcile run credits 0);
  - same `settled` row driven twice concurrently → `topUpWallet` called once;
  - `payment_hash` unique violation on insert → resume-from-settled (success) / in-flight → 409
    duplicate / non-unique errors rethrown;
  - backlog reporting and per-row failure counting;
  - existing v1 specs updated for the new `markSettledAsSucceeded` gate.
- `x402-reconcile-settled.handler.spec.ts` — queue name/policy/concurrency, drives a pass and
  reschedules, reschedules even when the pass throws.
- `x402-reconcile-job.service.spec.ts` — seeds only when enabled, skips when disabled / no pay-to
  address, cancel-then-enqueue on schedule.

Run:

```
npx tsc -p tsconfig.build.json --noEmit           # clean
npx eslint <touched dirs> --quiet                 # clean
npx vitest run --project=unit \
  src/billing/services/x402/x402.service.spec.ts \
  src/billing/services/x402-reconcile-settled/x402-reconcile-settled.handler.spec.ts \
  src/billing/services/x402-reconcile-job/x402-reconcile-job.service.spec.ts   # 21 passed
```

## Notes / left for manual follow-up

- No DB migration was needed: the unique index already exists (migration 0032) and the reconcile job
  reuses existing columns/indexes (`status_idx`); `updated_at` is not separately indexed, acceptable
  at current volume.
- Live dogfooding against a funded testnet wallet (actually stranding a settlement and watching the
  job credit it) is out of scope for this offline branch — the crash-before-credit path is covered
  by unit tests instead.
- pg-boss cron is disabled repo-wide (`schedule: false`); the reconcile loop uses the repo's existing
  self-rescheduling pattern (`startAfter` + `singletonKey`) rather than pg-boss `schedule()`.
