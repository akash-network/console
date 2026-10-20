import { describe, expect, it } from "vitest";

import { formatReclaimDeadline } from "./reclaim-deadline";

describe("formatReclaimDeadline", () => {
  const HOUR_MS = 3_600_000;
  const JUNE_8_2025_16_00_UTC = 1749398400;

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

  it("renders the deadline in the recipient's timezone and names it", () => {
    const nowMs = (JUNE_8_2025_16_00_UTC - 3 * 3600) * 1000;

    expect(formatReclaimDeadline(JUNE_8_2025_16_00_UTC, nowMs, "Europe/Paris")).toBe("2025-06-08 18:00 Central European Summer Time (about 3 hours from now)");
  });

  it("moves the date along with the time when the zone is a day ahead", () => {
    expect(formatReclaimDeadline(JUNE_8_2025_16_00_UTC, 0, "Asia/Tokyo")).toMatch(/^2025-06-09 01:00 Japan Standard Time /);
  });

  it("writes midnight as 00:00", () => {
    expect(formatReclaimDeadline(JUNE_8_2025_16_00_UTC, 0, "Asia/Shanghai")).toMatch(/^2025-06-09 00:00 China Standard Time /);
  });

  it.each([null, undefined, "Mars/Olympus", "+05:00"])("renders the deadline in UTC when the recipient's timezone is %j", timeZone => {
    expect(formatReclaimDeadline(JUNE_8_2025_16_00_UTC, 0, timeZone)).toMatch(/^2025-06-08 16:00 UTC /);
  });

  it("calls UTC by its abbreviation when the recipient picked it", () => {
    expect(formatReclaimDeadline(JUNE_8_2025_16_00_UTC, 0, "UTC")).toMatch(/^2025-06-08 16:00 UTC /);
  });
});
