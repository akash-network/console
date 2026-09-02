# WalletBalanceReloadCheckHandler - Logic Explanation

## Overview

This job worker automatically tops up a user's credit balance when auto top-up is enabled. It charges the user's default payment method, and the rule it applies comes from `walletSetting.autoReloadMode` — a per-user column, not a feature flag:

- **`threshold`** — fixed threshold/amount, described below. This is what the billing UI offers when a user enables auto top-up.
- **`prediction`** — predicted-spend, described at the end. Every row created before CON-884 has this mode, so existing users keep the behavior they signed up for until they switch.

Both modes are supported; neither is scheduled for removal. The `auto_reload_fixed_threshold` flag decides nothing here: background jobs run without a real Unleash user, so a flag could not express a per-user choice anyway. It has no reader left in `apps/api` and stays in the `FeatureFlags` map only because the default-deposit rollout gates on the same flag. In `apps/deploy-web` it gates whether the mode picker is offered.

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

### Charge rate limit

A second guard sits right before the charge, in **both modes**: at most one automatic charge attempt per `AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN` (default 60 minutes; `0` disables the cap) per wallet. Deployment funding drains a balance in lumps, so without a cap an expensive deployment can produce a burst of identical card charges within minutes: each one costs a flat Stripe fee, risks issuer velocity declines mid-burst, and reads as statement shock (CON-843 measures these bursts).

The cap is an atomic claim on `wallet_settings.last_auto_charge_at`, the same guarded-UPDATE pattern escrow top-ups use for `last_funded_at`: concurrent checks racing for the same wallet resolve to a single winner, so two overlapping jobs cannot both charge. A failed charge attempt **consumes the window** just like a successful one — the claim is never released. Releasing it on failure is what let a persistently declining card be re-attempted on every spend event (CON-927: ~108 declined charges per hour on one wallet); keeping it bounds a dead card to roughly one Stripe attempt per cooldown. The failed job still rethrows, and its pg-boss retry then loses the claim and defers, so the reload chain survives. A lost claim records a `charge_rate_limited` skip and reschedules the check for when the window reopens (cooldown plus a 1-minute buffer) instead of the usual 24h safety net, so a rate-limited reload is deferred, never dropped.

Manual top-ups never touch this path.

### Giving up on a declining card

The cooldown bounds how often a dead card is charged, but on its own it never stops: one attempt an hour is still ~720 declined charges a month, and card networks fine excessive reattempts of a declined payment. So a run of declines eventually pauses the wallet (CON-937).

Each declined charge increments `wallet_settings.auto_reload_failure_count`, and the cooldown handed to the next claim doubles with it (60 min, then 120, then 240, capped by `AUTO_RELOAD_CHARGE_BACKOFF_MAX_IN_MIN`). After `AUTO_RELOAD_MAX_CONSECUTIVE_DECLINES` declines — default 4, landing at roughly t=0, 1h, 3h and 7h — `auto_reload_paused_at` is stamped and the card is not charged again. A decline code the issuer will never approve (`lost_card`, `stolen_card`, `fraudulent`, and the rest of Stripe's never-retry list) pauses on the first decline instead of waiting out the count.

Only declines count. A Stripe outage, a rate limit, or a bug of ours leaves the counter alone, so an incident cannot pause every wallet at once. A charge that goes through resets the counter; a charge that merely asks for 3DS authentication does not, since no money moved.

A paused wallet is treated as opted out everywhere behaviour depends on it: the check itself skips with `AUTO_RELOAD_PAUSED` and stops rescheduling, no new checks are enqueued for it, the credits-low email takes over, and it drops out of the `insufficient_balance_with_auto_reload` metrics behind the funding alert. It is *not* excluded from escrow funding — existing credits keep funding deployments as before.

The user hears about it twice. The first decline of a run sends a "we couldn't charge your card" email saying retries continue, and the pause sends a second one saying they have stopped; the declines in between are silent, so a card having a bad day does not send one email per attempt. Without the first email the wallet would fail quietly for the whole ~7 hours it takes to reach the pause, and the credits-low email cannot fill that gap because it skips any wallet whose auto top-up still counts as active.

The pause lifts when the user changes their default payment method, or when they save their auto top-up settings again, both of which also clear the charge marker so the next check can charge straight away rather than waiting out the cooldown the dead card consumed.

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
4. On a self-rescheduled job that acts only as a safety net: 24h out normally, or at the charge-window reopen when the previous check was rate-limited.

Because pg-boss's `singleton` policy uniqueness applies only to *active* jobs, an immediate enqueue is never swallowed by the pending daily safety-net job. Top-ups therefore happen within seconds of the balance crossing the threshold.

## Validation flow

Before charging, the handler validates:

1. ✅ Wallet setting exists
2. ✅ Auto-reload is enabled
3. ✅ Auto-reload is not paused after repeated declines
4. ✅ Wallet is initialized (has address)
5. ✅ User has a Stripe customer ID
6. ✅ Default payment method exists

If any validation fails, the handler logs and skips processing (does not throw).

## Payment intent

The charge uses a job-scoped idempotency key (`WalletBalanceReloadCheck.<jobId>`), `confirm: true`, and `onAmountMismatch: "tolerate"`. Tolerate keeps retries safe when the computed amount differs between attempts — e.g. the user edited their settings or switched modes between the original charge and a retry under the reused key.

## What happens on failure?

- **Payment fails**: The error is logged and re-thrown (job fails, will retry under the same idempotency key). The charge claim is kept, so the retry loses it, records a `charge_rate_limited` skip, and defers the next check to the window reopen — a fresh attempt happens once per cooldown, not once per retry. A card decline is also counted towards the pause limit above, best-effort: a failed count is recorded on `wallet_balance_reload_check_decline_recording_errors_total` rather than replacing the payment error.
- **Validation fails**: Error is logged, job completes successfully (no retry needed).
- **Scheduling next check fails**: Error is logged and re-thrown.

**Observability**: alerts fire on failures even when the job ends successfully on validation errors, so the team can react promptly.

---

## Prediction mode

This is the pre-CON-717 behavior, kept as a supported mode by CON-884. It predicts upcoming spend instead of comparing against a fixed threshold:

1. **Calculate** the unfunded cost to keep all auto-top-up deployments running for the next 7 days (`RELOAD_COVERAGE_PERIOD_IN_MS`), excluding the portion already covered by escrow.
2. **Compare** the balance against 25% of that projection (`MIN_COVERAGE_PERCENTAGE`). Reload when `balance < 0.25 * costUntilTargetDate` (~1.75 days of coverage remaining).
3. **Claim** the charge window — the same rate limit and decline handling as threshold mode (see "Charge rate limit" above). A lost claim defers the reload to the window reopen.
4. **Charge** `max(costUntilTargetDate - balance, $20)`.
5. **Skip** entirely when the projected cost is 0 (no active auto-top-up deployments).
6. **Schedule** the next check 24 hours out.

Key constants: Check Interval 24h, Reload Coverage Period 7 days, Minimum Coverage Percentage 25%, Minimum Reload $20.

Note that `autoReloadThreshold` and `autoReloadAmount` are ignored in this mode — the amounts are derived from projected spend. They stay on the row so that switching to threshold mode and back preserves them.
