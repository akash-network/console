# Onboarding wallet init — observability

This runbook covers the async wallet provisioning kicked off by the `OnboardingStarted` event when the `console_onboarding_redesign` feature flag is on.

## Signals

### Structured log events

| Event | Where | Meaning |
|---|---|---|
| `ONBOARDING_INIT_STARTED` | `OnboardingStartedHandler` | Handler picked up a job and is about to provision the wallet. |
| `ONBOARDING_INIT_SUCCEEDED` | `OnboardingStartedHandler` | Wallet provisioning completed; `user_wallets.status = 'ready'`. |
| `ONBOARDING_INIT_FAILED` | `OnboardingStartedHandler` | Handler threw — pg-boss will retry (5 attempts, exponential backoff). |
| `ONBOARDING_WALLET_READY` | `WalletInitializerService.initializeForOnboarding` | Wallet row updated with address + allowances + `status='ready'`. |
| `ONBOARDING_WALLET_FAILED` | `WalletInitializerService.initializeForOnboarding` | Chain grant failed; wallet flipped to `status='failed'`, error logged. |

Every event carries `userId`. `ONBOARDING_WALLET_READY` and `ONBOARDING_WALLET_FAILED` also carry `walletId`.

### OpenTelemetry spans

- **`OnboardingStartedHandler.handle`** — wraps the full async init. Attribute `user.id`. Span status reflects success/failure.

### pg-boss queue

- Queue name: `OnboardingStarted` (one job per registered user when FF is on).
- Retry policy: 5 attempts, exponential backoff (`retryBackoff: true`), max 5 minutes between retries (`retryDelayMax: 300s`).

## Alert thresholds

| Signal | Threshold | Severity | Page? |
|---|---|---|---|
| `ONBOARDING_INIT_FAILED` rate | > 1% over 10m | P2 | yes |
| `OnboardingStartedHandler.handle` p99 duration | > 30s over 10m | P2 | yes |
| pg-boss queue depth for `OnboardingStarted` | > 100 sustained for 5m | P3 | no |
| Span error rate (OTel status=ERROR) | > 5% over 10m | P1 | yes |
| Users with `user_wallets.status = 'failed'` (count delta) | > 10/hour | P1 | yes |

The p99 alert at 30s is intentionally tight against the 60s user-facing polling cap — at 30s we're on the path to a degraded UX; alerting then gives time to mitigate before users hit the failure banner.

## Dashboards

A tile on the API dashboard should plot:

- Counts of `ONBOARDING_INIT_STARTED`, `_SUCCEEDED`, `_FAILED` over time.
- p50 / p99 of the `OnboardingStartedHandler.handle` span duration.
- pg-boss queue depth for `OnboardingStarted`.
- Rolling count of `user_wallets.status = 'failed'`.

## Runbook on failure

1. Check `ONBOARDING_INIT_FAILED` logs for `error.message` and stack — typical causes:
   - Chain RPC timeout / unavailable (`ECONNREFUSED`, `Service Unavailable`, etc.).
   - Funding wallet out of gas.
   - DB lock contention on `user_wallets` insert/update.
2. If chain-side: check upstream provider status + Akash RPC dashboards.
3. If DB-side: check Postgres CPU / connection pool / lock waits.
4. Affected users see a `"We couldn't prepare your account. Please contact support."` banner on the deploy page. Triage:
   - For transient failures, manually re-enqueue an `OnboardingStarted` job for the affected `userId` (pg-boss `send`). Idempotent — `OnboardingStartedHandler` calls `initializeForOnboarding`, which is safe to re-run because the wallet row already exists with `status='failed'`. Verify the implementation handles "wallet already exists" correctly before relying on this, or fall back to manually flipping `status` back to `'pending'` and re-enqueueing.
   - For systemic failures, leave the queue paused while diagnosing — failed jobs hit pg-boss's archive after retries are exhausted, preserving forensic trail.

## Feature-flag toggle

`console_onboarding_redesign` (Unleash). When toggled off, the `OnboardingStarted` event is never published from `UserService.registerUser`. Existing pending/failed wallets are unaffected — they keep their `status` and continue to gate deploys until manually resolved.
