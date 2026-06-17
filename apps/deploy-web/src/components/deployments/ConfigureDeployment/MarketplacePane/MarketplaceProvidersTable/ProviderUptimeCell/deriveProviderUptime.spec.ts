import { describe, expect, it } from "vitest";

import { deriveProviderUptime } from "./deriveProviderUptime";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");
const SECONDS_PER_DAY = 24 * 60 * 60;
const WINDOW_SECONDS = 7 * SECONDS_PER_DAY;

/** Builds a per-day downtime row; fields default to a single, closed, low-downtime incident. */
function day(overrides: { date: string; downtimeSeconds?: number; incidentCount?: number; hasOpenIncident?: boolean }) {
  return { downtimeSeconds: 0, incidentCount: 1, hasOpenIncident: false, ...overrides };
}

describe("deriveProviderUptime", () => {
  it("reports 100% uptime and 7 all-online buckets when there are no incidents", () => {
    const result = deriveProviderUptime([], NOW, "UTC");

    expect(result.percent).toBe(1);
    expect(result.buckets).toHaveLength(7);
    expect(result.buckets.every(bucket => bucket.status === "online")).toBe(true);
  });

  it("marks a fully-down day offline and drops the percentage accordingly", () => {
    const result = deriveProviderUptime([day({ date: "2026-06-15", downtimeSeconds: SECONDS_PER_DAY })], NOW, "UTC");

    expect(result.buckets[6].status).toBe("offline");
    expect(result.percent).toBeCloseTo(1 - SECONDS_PER_DAY / WINDOW_SECONDS, 6);
  });

  it("ignores out-of-window rows when computing the percentage so it never diverges from the sparkline", () => {
    const result = deriveProviderUptime(
      [day({ date: "2026-06-15", downtimeSeconds: SECONDS_PER_DAY }), day({ date: "2026-06-01", downtimeSeconds: SECONDS_PER_DAY })],
      NOW,
      "UTC"
    );

    expect(result.buckets).toHaveLength(7);
    expect(result.percent).toBeCloseTo(1 - SECONDS_PER_DAY / WINDOW_SECONDS, 6);
  });

  it("marks a day partial when downtime is below half the day", () => {
    const result = deriveProviderUptime([day({ date: "2026-06-09", downtimeSeconds: 6 * 60 * 60 })], NOW, "UTC");

    expect(result.buckets[0].status).toBe("partial");
  });

  it("treats days absent from the response as healthy and places downtime in its calendar bucket", () => {
    const result = deriveProviderUptime([day({ date: "2026-06-13", downtimeSeconds: SECONDS_PER_DAY })], NOW, "UTC");

    expect(result.buckets.map(bucket => bucket.status)).toEqual(["online", "online", "online", "online", "offline", "online", "online"]);
  });

  it("escalates a low-downtime but high-frequency (flapping) day to offline", () => {
    const result = deriveProviderUptime([day({ date: "2026-06-12", downtimeSeconds: 60, incidentCount: 12 })], NOW, "UTC");

    expect(result.buckets[3].status).toBe("offline");
    expect(result.percent).toBeGreaterThan(0.99);
  });

  it("escalates a few incidents to partial even with negligible downtime", () => {
    const result = deriveProviderUptime([day({ date: "2026-06-12", downtimeSeconds: 30, incidentCount: 3 })], NOW, "UTC");

    expect(result.buckets[3].status).toBe("partial");
  });

  it("forces today's bucket into a full live-down state when an incident is open", () => {
    const result = deriveProviderUptime([day({ date: "2026-06-15", downtimeSeconds: 60, incidentCount: 1, hasOpenIncident: true })], NOW, "UTC");

    expect(result.buckets[6].isLiveDown).toBe(true);
    expect(result.buckets[6].status).toBe("offline");
  });
});
