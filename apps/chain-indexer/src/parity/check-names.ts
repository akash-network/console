export const PARITY_CHECK_NAMES = ["daily-counts", "active-sets", "balances", "http"] as const;

export type ParityCheckName = (typeof PARITY_CHECK_NAMES)[number];
