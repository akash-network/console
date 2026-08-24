/**
 * A runtime limit is granted in increments: at most 48 hours when a deployment has none, and at most
 * 48 more per extension. Capping the increment keeps a user confirming within a day or two that they
 * still want the deployment running, which is the point of asking for a limit at all.
 */
export const MAX_RUNTIME_LIMIT_INCREMENT_HOURS = 48;

/** Ceiling on a runtime limit's total, reachable only by repeated extensions. */
export const MAX_RUNTIME_LIMIT_HOURS = 8760;
