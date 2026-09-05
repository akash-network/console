/** Guards `2 ** exponent` against a raised decline limit, since the result is interpolated into a Postgres interval. */
const MAX_BACKOFF_DOUBLINGS = 16;

export type ChargeCooldownConfig = { baseMinutes: number; maxMinutes: number };

/**
 * Doubles the gap after each consecutive decline, so the attempts a dead card is allowed span
 * hours instead of landing back to back. A base of 0 keeps meaning "no cap at all".
 */
export function calculateChargeCooldownMinutes(config: ChargeCooldownConfig, failureCount: number): number {
  if (config.baseMinutes === 0 || failureCount <= 0) {
    return config.baseMinutes;
  }

  const doublings = Math.min(failureCount - 1, MAX_BACKOFF_DOUBLINGS);
  const backedOff = Math.min(config.baseMinutes * 2 ** doublings, config.maxMinutes);

  return Math.max(config.baseMinutes, backedOff);
}
