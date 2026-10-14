import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relativeTime";

describe(formatRelativeTime.name, () => {
  const now = new Date("2026-10-08T12:00:00.000Z");

  it.each([
    ["2026-10-08T11:59:30.000Z", "Just now"],
    ["2026-10-08T11:59:00.000Z", "1 minute ago"],
    ["2026-10-08T11:15:00.000Z", "45 minutes ago"],
    ["2026-10-08T11:00:00.000Z", "1 hour ago"],
    ["2026-10-08T03:00:00.000Z", "9 hours ago"],
    ["2026-10-07T09:00:00.000Z", "Yesterday"],
    ["2026-10-05T12:00:00.000Z", "3 days ago"],
    ["2026-10-01T12:00:00.000Z", "1 week ago"],
    ["2026-09-15T12:00:00.000Z", "3 weeks ago"]
  ])("describes %s as %s", (timestamp, expected) => {
    expect(formatRelativeTime(timestamp, now)).toBe(expected);
  });

  it("falls back to the date after a month, without the year while it is the current one", () => {
    expect(formatRelativeTime(new Date(2026, 7, 14, 12), now)).toBe("Aug 14");
  });

  it("adds the year to a date from another year", () => {
    expect(formatRelativeTime(new Date(2025, 9, 28, 12), now)).toBe("Oct 28, 2025");
  });

  it("accepts an epoch timestamp", () => {
    expect(formatRelativeTime(now.getTime() - 2 * 60 * 60 * 1000, now)).toBe("2 hours ago");
  });
});
