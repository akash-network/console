import { afterEach, describe, expect, it, vi } from "vitest";

import { usePhasedProgressBar } from "./usePhasedProgressBar";

import { act, renderHook } from "@testing-library/react";

describe(usePhasedProgressBar.name, () => {
  it("starts at 0 before any frame runs", () => {
    const { result } = setup({ activeIndex: 0 });

    expect(result.current).toBe(0);
  });

  it("eases the bar upward while a phase is being worked on", () => {
    const { result, frame } = setup({ activeIndex: 0 });

    act(() => frame(0));
    act(() => frame(1000));
    const afterOneSecond = result.current;
    act(() => frame(3000));

    expect(afterOneSecond).toBeGreaterThan(0);
    expect(result.current).toBeGreaterThan(afterOneSecond);
  });

  it("stalls just short of the next marker while the phase keeps working", () => {
    const { result, frame } = setup({ activeIndex: 0 });

    act(() => frame(0));
    for (let t = 1000; t <= 120_000; t += 1000) {
      act(() => frame(t));
    }

    expect(result.current).toBeGreaterThan(33.33 * 0.9);
    expect(result.current).toBeLessThan(33.34);
  });

  it("snaps straight to a phase's marker when that phase completed before the creep reached it", () => {
    const { result, frame, rerender } = setup({ activeIndex: 0 });

    act(() => frame(0));
    act(() => frame(200));
    expect(result.current).toBeLessThan(33.33);

    rerender({ activeIndex: 1 });
    act(() => frame(400));

    expect(result.current).toBeGreaterThanOrEqual(33.33);
  });

  it("never moves backward when the active phase advances", () => {
    const { result, frame, rerender } = setup({ activeIndex: 0 });

    act(() => frame(0));
    for (let t = 1000; t <= 60_000; t += 1000) {
      act(() => frame(t));
    }
    const beforeAdvance = result.current;

    rerender({ activeIndex: 1 });
    act(() => frame(61_000));

    expect(result.current).toBeGreaterThanOrEqual(beforeAdvance);
  });

  it("drives all the way to 100 once every phase is complete", () => {
    const { result, frame } = setup({ activeIndex: 3 });

    act(() => frame(0));
    for (let t = 1000; t <= 60_000; t += 1000) {
      act(() => frame(t));
    }

    expect(result.current).toBe(100);
  });

  it("resets to 0 when the reset key changes", () => {
    const { result, frame, rerender } = setup({ activeIndex: 0, resetKey: 0 });

    act(() => frame(0));
    for (let t = 1000; t <= 20_000; t += 1000) {
      act(() => frame(t));
    }
    expect(result.current).toBeGreaterThan(0);

    rerender({ activeIndex: 0, resetKey: 1 });

    expect(result.current).toBe(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(input: { activeIndex: number; resetKey?: unknown }) {
    let pending: FrameRequestCallback | null = null;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(cb => {
      pending = cb;
      return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {
      pending = null;
    });

    const frame = (ts: number) => {
      const cb = pending;
      pending = null;
      cb?.(ts);
    };

    const markers = [33.33, 66.66, 100] as const;
    const timeConstants = [3000, 12000, 6000] as const;

    type Props = { activeIndex: number; resetKey?: unknown };
    const view = renderHook<number, Props>(({ activeIndex, resetKey }) => usePhasedProgressBar({ markers, activeIndex, timeConstants, resetKey }), {
      initialProps: { activeIndex: input.activeIndex, resetKey: input.resetKey }
    });

    return { ...view, frame };
  }
});
