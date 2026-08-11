/** Parent-hash continuity break; fatal by design so the process halts instead of committing a forked history. */
export class ChainContinuityError extends Error {}
