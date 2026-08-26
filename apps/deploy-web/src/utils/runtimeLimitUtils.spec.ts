import { describe, expect, it, vi } from "vitest";

import { formatRuntimeLimit } from "./runtimeLimitUtils";

describe(formatRuntimeLimit.name, () => {
  it("shows only the limit before the countdown is anchored", () => {
    expect(formatRuntimeLimit(12, null)).toBe("12h");
  });

  it("shows whole hours remaining when the deadline lands on the hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      expect(formatRuntimeLimit(12, "2026-08-21T17:00:00.000Z")).toBe("12h · 5h left");
    } finally {
      vi.useRealTimers();
    }
  });

  it("adds the minutes when the remaining time is not a whole number of hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      expect(formatRuntimeLimit(12, "2026-08-21T14:10:00.000Z")).toBe("12h · 2h 10m left");
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts in minutes alone once under an hour remains", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      expect(formatRuntimeLimit(12, "2026-08-21T12:45:00.000Z")).toBe("12h · 45m left");
    } finally {
      vi.useRealTimers();
    }
  });

  it("still reads a full minute through the final seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      expect(formatRuntimeLimit(12, "2026-08-21T12:00:01.000Z")).toBe("12h · 1m left");
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks the limit as reached once the deadline passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      expect(formatRuntimeLimit(12, "2026-08-21T11:00:00.000Z")).toBe("12h · limit reached");
    } finally {
      vi.useRealTimers();
    }
  });
});
