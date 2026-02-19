import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThrottledEffect } from "./useThrottledEffect";

import { act, renderHook } from "@testing-library/react";

describe(useThrottledEffect.name, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("executes effect after delay", () => {
    const effect = vi.fn();
    renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("throttles rapid dependency changes", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    rerender({ deps: [2] });
    rerender({ deps: [3] });
    rerender({ deps: [4] });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
    expect(effect).toHaveBeenCalledWith();
  });

  it("cancels previous timeout when dependencies change", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    rerender({ deps: [2] });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("calls cleanup function when effect returns cleanup", () => {
    const cleanup = vi.fn();
    const effect = vi.fn(() => cleanup);

    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);

    rerender({ deps: [2] });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("handles effect that returns void", () => {
    const effect = vi.fn(() => {});

    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);

    rerender({ deps: [2] });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("uses default delay of 100ms", () => {
    const effect = vi.fn();
    renderHook(({ deps }) => useThrottledEffect(effect, deps), {
      initialProps: { deps: [1] }
    });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("respects custom delay", () => {
    const effect = vi.fn();
    renderHook(({ deps }) => useThrottledEffect(effect, deps, 200), {
      initialProps: { deps: [1] }
    });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("cleans up on unmount", () => {
    const cleanup = vi.fn();
    const effect = vi.fn(() => cleanup);

    const { unmount } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);

    unmount();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("handles multiple rapid changes with cleanup", () => {
    const cleanup = vi.fn();
    const effect = vi.fn(() => cleanup);

    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);

    rerender({ deps: [2] });
    rerender({ deps: [3] });
    rerender({ deps: [4] });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("handles empty dependency array", () => {
    const effect = vi.fn();
    renderHook(() => useThrottledEffect(effect, [], 100));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("handles undefined dependencies", () => {
    const effect = vi.fn();
    renderHook(() => useThrottledEffect(effect, [], 100));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });
});
