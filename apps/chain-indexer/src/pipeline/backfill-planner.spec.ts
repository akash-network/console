import { describe, expect, it } from "vitest";

import { planBackfill } from "@src/pipeline/backfill-planner";

describe(planBackfill.name, () => {
  it("runs the full range when there is no checkpoint", () => {
    const plan = planBackfill({ fromHeight: 100, toHeight: 200, checkpointHeight: null, tipHeight: 1_000 });

    expect(plan).toEqual({ kind: "run", startHeight: 100, endHeight: 200 });
  });

  it("resumes after the checkpoint when one exists mid-range", () => {
    const plan = planBackfill({ fromHeight: 100, toHeight: 200, checkpointHeight: 150, tipHeight: 1_000 });

    expect(plan).toEqual({ kind: "run", startHeight: 151, endHeight: 200 });
  });

  it("reports already-complete when the checkpoint reached the end of the range", () => {
    const plan = planBackfill({ fromHeight: 100, toHeight: 200, checkpointHeight: 200, tipHeight: 1_000 });

    expect(plan).toEqual({ kind: "already-complete" });
  });

  it("rejects a range ending above the chain tip", () => {
    const plan = planBackfill({ fromHeight: 100, toHeight: 2_000, checkpointHeight: null, tipHeight: 1_000 });

    expect(plan).toEqual({ kind: "invalid", reason: "BACKFILL_TO_HEIGHT 2000 is above the chain tip 1000" });
  });

  it("runs a single-block range", () => {
    const plan = planBackfill({ fromHeight: 100, toHeight: 100, checkpointHeight: null, tipHeight: 1_000 });

    expect(plan).toEqual({ kind: "run", startHeight: 100, endHeight: 100 });
  });
});
