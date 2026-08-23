import { describe, expect, it, vi } from "vitest";

import { formatRuntimeLimit } from "./runtimeLimitUtils";

describe(formatRuntimeLimit.name, () => {
  it("shows only the limit before the countdown is anchored", () => {
    expect(formatRuntimeLimit(12, null)).toBe("12h");
  });

  it("shows the remaining time while the countdown runs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      expect(formatRuntimeLimit(12, "2026-08-21T17:00:00.000Z")).toBe("12h · ~5h left");
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks the limit as reached once the deadline passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      expect(formatRuntimeLimit(12, "2026-08-21T11:00:00.000Z")).toBe("12h · reached");
    } finally {
      vi.useRealTimers();
    }
  });
});
