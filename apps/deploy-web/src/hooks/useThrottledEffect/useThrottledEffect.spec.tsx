import { useThrottledEffect } from "./useThrottledEffect";

import { act, renderHook } from "@testing-library/react";

describe(useThrottledEffect.name, () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("executes effect after delay", () => {
    const effect = jest.fn();
    renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("throttles rapid dependency changes", () => {
    const effect = jest.fn();
    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    rerender({ deps: [2] });
    rerender({ deps: [3] });
    rerender({ deps: [4] });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
    expect(effect).toHaveBeenCalledWith();
  });

  it("cancels previous timeout when dependencies change", () => {
    const effect = jest.fn();
    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      jest.advanceTimersByTime(50);
    });

    rerender({ deps: [2] });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("calls cleanup function when effect returns cleanup", () => {
    const cleanup = jest.fn();
    const effect = jest.fn(() => cleanup);

    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);

    rerender({ deps: [2] });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("handles effect that returns void", () => {
    const effect = jest.fn(() => {});

    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);

    rerender({ deps: [2] });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("uses default delay of 100ms", () => {
    const effect = jest.fn();
    renderHook(({ deps }) => useThrottledEffect(effect, deps), {
      initialProps: { deps: [1] }
    });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("respects custom delay", () => {
    const effect = jest.fn();
    renderHook(({ deps }) => useThrottledEffect(effect, deps, 200), {
      initialProps: { deps: [1] }
    });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("cleans up on unmount", () => {
    const cleanup = jest.fn();
    const effect = jest.fn(() => cleanup);

    const { unmount } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);

    unmount();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("handles multiple rapid changes with cleanup", () => {
    const cleanup = jest.fn();
    const effect = jest.fn(() => cleanup);

    const { rerender } = renderHook(({ deps }) => useThrottledEffect(effect, deps, 100), { initialProps: { deps: [1] } });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);

    rerender({ deps: [2] });
    rerender({ deps: [3] });
    rerender({ deps: [4] });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(4);
  });

  it("handles empty dependency array", () => {
    const effect = jest.fn();
    renderHook(() => useThrottledEffect(effect, [], 100));

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("handles undefined dependencies", () => {
    const effect = jest.fn();
    renderHook(() => useThrottledEffect(effect, [], 100));

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });
});
