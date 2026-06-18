import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePacedValue } from "./usePacedValue";

import { act, renderHook } from "@testing-library/react";

describe(usePacedValue.name, () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits the first value immediately, without waiting", () => {
    const { result } = setup({ value: "a" });

    expect(result.current).toBe("a");
  });

  it("collapses a burst of changes into the last value once edits settle", () => {
    const { result, rerender } = setup({ value: "a" });

    rerender({ value: "b", wait: 200, maxWait: 2000 });
    rerender({ value: "c", wait: 200, maxWait: 2000 });
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toBe("c");
  });

  it("emits at the maxWait ceiling even when changes never settle", () => {
    const { result, rerender } = setup({ value: "v0", wait: 200, maxWait: 500 });

    for (let edit = 1; edit <= 4; edit++) {
      act(() => vi.advanceTimersByTime(150));
      rerender({ value: `v${edit}`, wait: 200, maxWait: 500 });
    }

    expect(result.current).not.toBe("v0");
  });

  it("does not emit a pending change after unmount", () => {
    const { result, rerender, unmount } = setup({ value: "a" });

    rerender({ value: "b", wait: 200, maxWait: 2000 });
    unmount();
    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toBe("a");
  });

  function setup(initial: { value: string; wait?: number; maxWait?: number }) {
    return renderHook(({ value, wait, maxWait }) => usePacedValue(value, { wait, maxWait }), {
      initialProps: { value: initial.value, wait: initial.wait ?? 200, maxWait: initial.maxWait ?? 2000 }
    });
  }
});
