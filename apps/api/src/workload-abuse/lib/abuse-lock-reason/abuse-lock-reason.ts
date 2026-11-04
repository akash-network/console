export const ABUSE_LOCK_REASON = "workload_abuse";

export const BLOCKED_DOMAIN_LOCK_REASON = "blocked_domain";

export type AbuseLockReason = typeof ABUSE_LOCK_REASON | typeof BLOCKED_DOMAIN_LOCK_REASON;
