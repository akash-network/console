export const ABUSE_LOCK_REASON = "workload_abuse";

export const BLOCKED_DOMAIN_LOCK_REASON = "blocked_domain";

export const DELETED_TRIAL_ACCOUNT_LOCK_REASON = "deleted_trial_account";

export type AbuseLockReason = typeof ABUSE_LOCK_REASON | typeof BLOCKED_DOMAIN_LOCK_REASON;
