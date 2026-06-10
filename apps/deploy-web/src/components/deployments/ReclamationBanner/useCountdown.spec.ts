import { afterEach, describe, expect, it, vi } from "vitest";

import { useCountdown } from "./useCountdown";

import { act, renderHook } from "@testing-library/react";

describe(useCountdown.name, () => {
  const NOW = new Date("2026-06-05T00:00:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when there is no deadline", () => {
    const { result } = setup({ secondsFromNow: null });
    expect(result.current).toBeNull();
  });

  it("does not schedule a timer when there is no deadline", () => {
    setup({ secondsFromNow: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns null when the deadline has already passed", () => {
    const { result } = setup({ secondsFromNow: -60 });
    expect(result.current).toBeNull();
  });

  it("returns null at the exact deadline", () => {
    const { result } = setup({ secondsFromNow: 0 });
    expect(result.current).toBeNull();
  });

  it("formats the remaining time down to days, hours, minutes and seconds", () => {
    const { result } = setup({ secondsFromNow: 2 * 86400 + 3 * 3600 + 4 * 60 + 5 });
    expect(result.current).toBe("2 days, 3 hours, 4 minutes, 5 seconds");
  });

  it("counts down as each second elapses", () => {
    const { result } = setup({ secondsFromNow: 5 });
    expect(result.current).toBe("5 seconds");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe("4 seconds");
  });

  it("returns null once the deadline passes while counting down", () => {
    const { result } = setup({ secondsFromNow: 2 });
    expect(result.current).toBe("2 seconds");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBeNull();
  });

  it("clears the interval once the deadline is reached so it stops re-rendering", () => {
    setup({ secondsFromNow: 2 });
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops ticking after unmount", () => {
    const { unmount } = setup({ secondsFromNow: 60 });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("recomputes when the deadline changes", () => {
    const { result, rerender } = setup({ secondsFromNow: 60 });
    expect(result.current).toBe("1 minute");

    rerender({ secondsFromNow: 3600 });

    expect(result.current).toBe("1 hour");
  });

  function setup(input: { secondsFromNow: number | null }) {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const toDeadline = (secondsFromNow: number | null) => (secondsFromNow === null ? null : new Date(NOW.getTime() + secondsFromNow * 1000));
    return renderHook(({ secondsFromNow }) => useCountdown(toDeadline(secondsFromNow)), { initialProps: { secondsFromNow: input.secondsFromNow } });
  }
});
