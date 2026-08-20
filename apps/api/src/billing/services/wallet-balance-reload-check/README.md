# WalletBalanceReloadCheckHandler - Logic Explanation

## Overview

This job worker automatically tops up a user's credit balance when auto top-up is enabled. It charges the user's default payment method, and the rule it applies comes from `walletSetting.autoReloadMode` — a per-user column, not a feature flag:

- **`threshold`** — fixed threshold/amount, described below. This is what the billing UI offers when a user enables auto top-up.
- **`prediction`** — predicted-spend, described at the end. Every row created before CON-884 has this mode, so existing users keep the behavior they signed up for until they switch.

Both modes are supported; neither is scheduled for removal. The `auto_reload_fixed_threshold` flag still exists, but only in `apps/deploy-web`, where it gates whether the mode picker is offered. The handler never reads it: background jobs run without a real Unleash user, so a flag could not express a per-user choice here anyway.

## Threshold mode

A user configures two values on their wallet settings:

- **`autoReloadThreshold`** — the credit balance at or below which a top-up fires. Default **$20**, minimum $5.
- **`autoReloadAmount`** — the fixed amount charged on each top-up. Default **$100**, minimum $20 (`STANDARD_TOP_UP_MIN_AMOUNT_USD`).

### The rule

```text
if (balance <= autoReloadThreshold) {
  charge max(autoReloadAmount, $20)
}
```

The comparison is **inclusive**: a balance exactly at the threshold triggers a top-up. The `max(..., $20)` is a defensive clamp — there is no DB CHECK constraint, so the handler guarantees Stripe's minimum even if a smaller amount was somehow persisted.

The check is a pure balance comparison: it does not project future spend. The balance compared is the deployment-grant balance in USD (`getDeploymentBalanceInFiat`) — the same "Available Balance" shown on the billing page.

One guard sits after the comparison: when the wallet owns no active deployment the charge is skipped (`no_active_deployments`), so leftover credit below the threshold never gets topped up on an idle wallet. Checks enqueued by initial deployment funding (`triggeredByDeployment`) bypass that count, because it reads the indexer-fed `Deployment` table, which lags chain state right after a lease starts.

### Worked examples (defaults: threshold $20, amount $100)

| Balance | Threshold | Amount | Outcome |
| ------- | --------- | ------ | ------- |
| $20.00  | $20       | $100   | `balance <= threshold` → **charge $100** |
| $20.01  | $20       | $100   | `balance > threshold` → **skip** |
| $0.00   | $20       | $100   | **charge $100** (wallet has an active deployment) |
| $0.00   | $20       | $100   | **skip** `no_active_deployments` (idle wallet, check not deployment-triggered) |
| $5.00   | $20       | $15\*  | **charge $20** (clamped to the $20 minimum) |

\* An amount below $20 should never persist (zod rejects it on write); the clamp is defensive only.

## When does the check run?

Checks are **spend-event-driven**, not fixed to a daily cadence. A check is enqueued:

1. When a user enables auto top-up (immediate, prefilled from the settings dialog).
2. When a user changes their mode, threshold, or amount while enabled (immediate — backs the dialog's "top-up runs shortly after saving").
3. After every spending broadcast, after initial deployment funding, and after each escrow top-up cycle.
4. On a self-rescheduled 24h job that acts only as a safety net.

Because pg-boss's `singleton` policy uniqueness applies only to *active* jobs, an immediate enqueue is never swallowed by the pending daily safety-net job. Top-ups therefore happen within seconds of the balance crossing the threshold.

## Validation flow

Before charging, the handler validates:

1. ✅ Wallet setting exists
2. ✅ Auto-reload is enabled
3. ✅ Wallet is initialized (has address)
4. ✅ User has a Stripe customer ID
5. ✅ Default payment method exists

If any validation fails, the handler logs and skips processing (does not throw).

## Payment intent

The charge uses a job-scoped idempotency key (`WalletBalanceReloadCheck.<jobId>`), `confirm: true`, and `onAmountMismatch: "tolerate"`. Tolerate keeps retries safe when the computed amount differs between attempts — e.g. the user edited their settings or switched modes between the original charge and a retry under the reused key.

## What happens on failure?

- **Payment fails**: Error is logged and re-thrown (job fails, will retry).
- **Validation fails**: Error is logged, job completes successfully (no retry needed).
- **Scheduling next check fails**: Error is logged and re-thrown.

**Observability**: alerts fire on failures even when the job ends successfully on validation errors, so the team can react promptly.

---

## Prediction mode

This is the pre-CON-717 behavior, kept as a supported mode by CON-884. It predicts upcoming spend instead of comparing against a fixed threshold:

1. **Calculate** the unfunded cost to keep all auto-top-up deployments running for the next 7 days (`RELOAD_COVERAGE_PERIOD_IN_MS`), excluding the portion already covered by escrow.
2. **Compare** the balance against 25% of that projection (`MIN_COVERAGE_PERCENTAGE`). Reload when `balance < 0.25 * costUntilTargetDate` (~1.75 days of coverage remaining).
3. **Charge** `max(costUntilTargetDate - balance, $20)`.
4. **Skip** entirely when the projected cost is 0 (no active auto-top-up deployments).
5. **Schedule** the next check 24 hours out.

Key constants: Check Interval 24h, Reload Coverage Period 7 days, Minimum Coverage Percentage 25%, Minimum Reload $20.

Note that `autoReloadThreshold` and `autoReloadAmount` are ignored in this mode — the amounts are derived from projected spend. They stay on the row so that switching to threshold mode and back preserves them.
