import { describe, expect, it } from "vitest";

import { formatReclaimDeadline } from "./reclaim-deadline";

describe("formatReclaimDeadline", () => {
  const HOUR_MS = 3_600_000;

  it("renders the absolute UTC time and a relative window", () => {
    const deadlineSeconds = (72 * HOUR_MS) / 1000;

    expect(formatReclaimDeadline(deadlineSeconds, 0)).toBe("1970-01-04 00:00 UTC (about 72 hours from now)");
  });

  it("uses singular hour wording for a one-hour window", () => {
    const nowMs = 0;
    const deadlineSeconds = HOUR_MS / 1000;

    expect(formatReclaimDeadline(deadlineSeconds, nowMs)).toBe("1970-01-01 01:00 UTC (about 1 hour from now)");
  });

  it("describes a sub-hour window without an hour count", () => {
    const nowMs = 0;
    const deadlineSeconds = (30 * 60 * 1000) / 1000;

    expect(formatReclaimDeadline(deadlineSeconds, nowMs)).toBe("1970-01-01 00:30 UTC (less than an hour from now)");
  });

  it("notes when the deadline has already passed", () => {
    const nowMs = 10 * HOUR_MS;
    const deadlineSeconds = HOUR_MS / 1000;

    expect(formatReclaimDeadline(deadlineSeconds, nowMs)).toBe("1970-01-01 01:00 UTC (the deadline has passed)");
  });
});
