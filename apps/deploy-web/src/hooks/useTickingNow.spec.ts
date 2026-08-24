import { describe, expect, it, vi } from "vitest";

import { DEFAULT_TICK_INTERVAL_MS, useTickingNow } from "./useTickingNow";

import { act, renderHook } from "@testing-library/react";

describe(useTickingNow.name, () => {
  it("returns the mount-time clock without re-rendering while disabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      const { result } = renderHook(() => useTickingNow(false));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      });

      expect(result.current).toBe(new Date("2026-08-21T12:00:00.000Z").getTime());
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-renders with a fresh clock on every interval while enabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      const { result } = renderHook(() => useTickingNow(true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEFAULT_TICK_INTERVAL_MS);
      });

      expect(result.current).toBe(new Date("2026-08-21T12:01:00.000Z").getTime());
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops ticking once disabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      const { result, rerender } = renderHook(({ enabled }) => useTickingNow(enabled), { initialProps: { enabled: true } });
      rerender({ enabled: false });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEFAULT_TICK_INTERVAL_MS);
      });
      const frozenAt = result.current;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      });

      expect(result.current).toBe(frozenAt);
    } finally {
      vi.useRealTimers();
    }
  });
});
