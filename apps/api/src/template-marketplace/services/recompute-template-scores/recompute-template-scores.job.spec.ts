import { describe, expect, it } from "vitest";

import { nextScoreWindowAt, RecomputeTemplateScores, recomputeTemplateScoresKeyFor } from "./recompute-template-scores.job";

describe(nextScoreWindowAt.name, () => {
  it.each([
    { now: "2026-11-18T00:00:00.000Z", intervalSeconds: 21600, next: "2026-11-18T06:00:00.000Z" },
    { now: "2026-11-18T05:59:59.999Z", intervalSeconds: 21600, next: "2026-11-18T06:00:00.000Z" },
    { now: "2026-11-18T06:00:00.001Z", intervalSeconds: 21600, next: "2026-11-18T12:00:00.000Z" },
    { now: "2026-11-18T23:10:00.000Z", intervalSeconds: 21600, next: "2026-11-19T00:00:00.000Z" },
    { now: "2026-11-18T10:20:30.000Z", intervalSeconds: 3600, next: "2026-11-18T11:00:00.000Z" },
    { now: "2026-11-18T10:20:30.000Z", intervalSeconds: 60, next: "2026-11-18T10:21:00.000Z" }
  ])("answers $next after $now for windows of $intervalSeconds seconds", ({ now, intervalSeconds, next }) => {
    expect(nextScoreWindowAt(new Date(now), intervalSeconds).toISOString()).toBe(next);
  });
});

describe(RecomputeTemplateScores.name, () => {
  it("names its window in the job and in the key that keeps one run per window", () => {
    const windowStartsAt = new Date("2026-11-18T06:00:00.000Z");
    const job = new RecomputeTemplateScores({ windowStartsAt: windowStartsAt.toISOString() });

    expect(job).toMatchObject({ name: "RecomputeTemplateScores", version: 1, data: { windowStartsAt: "2026-11-18T06:00:00.000Z" } });
    expect(recomputeTemplateScoresKeyFor(windowStartsAt)).toBe("recomputeTemplateScores.2026-11-18T06:00:00.000Z");
  });
});
