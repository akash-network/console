export interface BackfillPlanInput {
  fromHeight: number;
  toHeight: number;
  checkpointHeight: number | null;
  tipHeight: number;
}

export type BackfillPlan = { kind: "run"; startHeight: number; endHeight: number } | { kind: "already-complete" } | { kind: "invalid"; reason: string };

/**
 * A range above the chain tip is rejected rather than clamped: clamping would mark the range's
 * checkpoint complete for heights that were never indexed. Completion is checked first so a
 * re-run of a finished range stays a no-op even when a lagging RPC node reports a stale tip.
 */
export function planBackfill(input: BackfillPlanInput): BackfillPlan {
  if (input.checkpointHeight !== null && input.checkpointHeight >= input.toHeight) {
    return { kind: "already-complete" };
  }

  if (input.toHeight > input.tipHeight) {
    return { kind: "invalid", reason: `BACKFILL_TO_HEIGHT ${input.toHeight} is above the chain tip ${input.tipHeight}` };
  }

  return {
    kind: "run",
    startHeight: input.checkpointHeight !== null ? input.checkpointHeight + 1 : input.fromHeight,
    endHeight: input.toHeight
  };
}
