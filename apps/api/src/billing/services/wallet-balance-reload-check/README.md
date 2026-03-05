# WalletBalanceReloadCheckHandler - Logic Explanation

## Overview

This job worker automatically reloads user wallet balances when they're running low relative to projected deployment costs for deployments with auto top-up enabled. It runs daily and proactively reloads funds when the balance can only cover less than 25% of the next 7 days of deployment costs.

## Core Logic

### The Problem

Users need sufficient funds to keep their deployments with auto top-up enabled running. Without auto-reload, deployments would stop when funds run out, requiring manual intervention.

### The Solution

1. **Calculate** how much money is needed to keep all deployments with auto top-up enabled running for 7 days
2. **Compare** current balance with 25% of that cost (threshold check)
3. **Reload** if balance is below threshold (with a $20 minimum)
4. **Schedule** the next check for 24 hours from now

### Key Design Decisions

**Why check daily?**

- Daily checks allow proactive reloading before funds run critically low
- Catches issues quickly if deployment costs spike
- Balances responsiveness with system load

**Why calculate costs for 7 days?**

- Provides a meaningful projection window for deployment costs
- Ensures reloads cover a full week of operations for deployments with auto top-up enabled
- Balances UX (users don't get charged too frequently) with transaction costs
- Reduces the number of payment transactions while maintaining adequate coverage

**Why reload at 25% threshold?**

- Reloads when balance can only cover less than ~1.75 days (25% of 7 days)
- Provides a safety margin before funds run out
- Prevents emergency situations

## When Does the Check Run?

The handler runs in four scenarios:

1. **When feature is enabled**: Immediately when a user enables auto-reload
2. **When deployment auto top-up is enabled**: Immediately when a user enables auto top-up on a deployment
3. **Scheduled checks**: Every 24 hours (1 day) for users with auto-reload enabled
4. **Immediate triggers**: When a user creates a deployment or makes a deposit

When auto-reload is enabled, the first check runs immediately. When deployment auto top-up is enabled, an immediate check is scheduled to ensure the wallet balance can cover the new deployment costs. Subsequent checks run on a daily schedule. Immediate triggers (deployments/deposits) ensure the balance is checked right after spending or depositing funds, rather than waiting for the next scheduled check.

## Sequence Diagram

```
User enables auto-reload
    │
    ▼
WalletSettingService schedules immediate check
    │
    ├─► [OR] User enables deployment auto top-up
    │   │
    │   ▼
    │   DeploymentSettingService.scheduleImmediate()
    │   │
    │   ▼
    │   WalletReloadJobService.scheduleImmediate()
    │
    ├─► [OR] User creates deployment / makes deposit
    │   │
    │   ▼
    │   ManagedSignerService.scheduleImmediate()
    │   │
    │   ▼
    │   WalletSettingService cancels existing job
    │   │
    │   ▼
    │   WalletSettingService enqueues immediate check
    │
    ▼
[Immediately when enabled, OR when deployment auto top-up enabled, OR 24 hours later for scheduled checks, OR immediately on deployment/deposit]
    │
    ▼
WalletBalanceReloadCheckHandler.handle()
    │
    ├─► Collect Resources
    │   ├─► Get wallet setting (verify auto-reload enabled)
    │   ├─► Get user wallet (verify initialized)
    │   ├─► Get user (verify Stripe customer ID)
    │   ├─► Get default payment method
    │   ├─► Get current balance (in USD)
    │   └─► Calculate cost for 7 days ahead (deployments with auto top-up enabled)
    │
    ├─► Try to Reload
    │   ├─► Compare: balance >= 25% of 7-day cost?
    │   │   ├─► YES: Skip reload, log "RELOAD_SKIPPED"
    │   │   └─► NO: Continue (balance can only cover < ~1.75 days)
    │   │
    │   ├─► Calculate reload amount
    │   │   └─► max(7-day-cost - balance, $20)
    │   │
    │   └─► Create Stripe payment intent
    │       └─► Charge user's default payment method
    │
    └─► Schedule Next Check
        ├─► Enqueue job for 24 hours from now
        └─► Update wallet setting with new job ID
```

## Reload Threshold Logic

The handler reloads when:

```
balance < 0.25 * costUntilTargetDateInFiat
```

This means: reload when balance can only cover less than 25% of the 7-day cost projection (~1.75 days).

**Example scenarios:**

1. **Balance: $10, 7-day Cost: $40**

   - 25% threshold: $10
   - Balance ($10) >= threshold ($10) → **Skip reload** (exactly at threshold)

2. **Balance: $9, 7-day Cost: $40**

   - 25% threshold: $10
   - Balance ($9) < threshold ($10) → **Reload**
   - Reload amount: max($40 - $9, $20) = $31

3. **Balance: $5, 7-day Cost: $20**

   - 25% threshold: $5
   - Balance ($5) >= threshold ($5) → **Skip reload** (exactly at threshold)

4. **Balance: $4, 7-day Cost: $20**
   - 25% threshold: $5
   - Balance ($4) < threshold ($5) → **Reload**
   - Reload amount: max($20 - $4, $20) = $20 (minimum applies)

## Cost Calculation

The handler calculates the total cost needed to keep all active deployments with auto top-up enabled running for 7 days:

1. Gets all auto-top-up deployments for the user's wallet
2. For each deployment:
   - Finds when it would close (predicted closed height)
   - Calculates blocks needed from closure to target date (7 days from now)
   - Multiplies by block rate to get cost
3. Sums all costs to get total 7-day cost

**Note**: Only deployments with auto top-up enabled are considered in the cost calculation.

**Target date**: 7 days from now (`RELOAD_COVERAGE_PERIOD_IN_MS`)

## Reload Amount Calculation

```
reloadAmount = max(costUntilTargetDateInFiat - balance, $20)
```

The reload amount ensures the balance can cover the full 7-day cost projection, with a $20 minimum to prevent tiny charges and meet Stripe's requirements.

## Validation Flow

Before processing, the handler validates:

1. ✅ Wallet setting exists
2. ✅ Auto-reload is enabled
3. ✅ Wallet is initialized (has address)
4. ✅ User has Stripe customer ID
5. ✅ Default payment method exists

If any validation fails, the handler logs an error and skips processing (doesn't throw).

## Key Constants

- **Check Interval**: 24 hours (1 day) - how often the job runs
- **Reload Coverage Period**: 7 days - period for which costs are calculated
- **Minimum Coverage Percentage**: 25% - triggers reload when balance falls below this percentage of 7-day cost
- **Minimum Reload**: $20 USD - prevents tiny charges

**Note**: These constants can be fine-tuned based on real-life UX data and user feedback to optimize the balance between user experience, transaction frequency, and system efficiency.

## What Happens on Failure?

- **Payment fails**: Error is logged and re-thrown (job fails, will retry)
- **Validation fails**: Error is logged, job completes successfully (no retry needed)
- **Job ID update fails**: Error is logged, job completes (next check still scheduled)

**Observability**: Observability is configured to alert on any issues when failures happen. Even when the job ends successfully on validation errors, alerts are triggered so the team can react and ensure issues are fixed promptly.
