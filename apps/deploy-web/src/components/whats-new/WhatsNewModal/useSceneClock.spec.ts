import { describe, expect, it, onTestFinished, vi } from "vitest";

import { useSceneClock } from "./useSceneClock";

import { act, renderHook } from "@testing-library/react";

describe(useSceneClock.name, () => {
  it("counts the seconds between frames while running", () => {
    const { result, frameAt } = setup({ isRunning: true });

    frameAt(1050);
    frameAt(1080);

    expect(result.current).toBeCloseTo(0.08);
  });

  it("stays at zero while stopped", () => {
    const { result, frameAt, pendingFrames } = setup({ isRunning: false });

    frameAt(1500);

    expect(result.current).toBe(0);
    expect(pendingFrames()).toBe(0);
  });

  it("caps a slow frame so a backgrounded tab does not skip the scene ahead", () => {
    const { result, frameAt } = setup({ isRunning: true });

    frameAt(1500);

    expect(result.current).toBeCloseTo(0.1);
  });

  it("ignores a frame stamped before the previous one", () => {
    const { result, frameAt } = setup({ isRunning: true });

    frameAt(1050);
    frameAt(1020);

    expect(result.current).toBeCloseTo(0.05);
  });

  it("holds its reading while paused and carries on from it", () => {
    const { result, rerender, frameAt, setNow } = setup({ isRunning: true });
    frameAt(1050);

    rerender({ isRunning: false, restartKey: "0" });
    frameAt(2000);
    expect(result.current).toBeCloseTo(0.05);

    setNow(3000);
    rerender({ isRunning: true, restartKey: "0" });
    frameAt(3030);
    expect(result.current).toBeCloseTo(0.08);
  });

  it("restarts from zero when the key changes", () => {
    const { result, rerender, frameAt, setNow } = setup({ isRunning: true });
    frameAt(1050);

    setNow(2000);
    rerender({ isRunning: true, restartKey: "1" });
    expect(result.current).toBe(0);

    frameAt(2040);
    expect(result.current).toBeCloseTo(0.04);
  });

  it("restarts from zero when the key changes while stopped", () => {
    const { result, rerender, frameAt, setNow } = setup({ isRunning: true });
    frameAt(1050);

    rerender({ isRunning: false, restartKey: "1" });
    expect(result.current).toBe(0);

    setNow(2000);
    rerender({ isRunning: true, restartKey: "1" });
    frameAt(2020);
    expect(result.current).toBeCloseTo(0.02);
  });

  it("stops requesting frames once unmounted", () => {
    const { unmount, pendingFrames } = setup({ isRunning: true });

    unmount();

    expect(pendingFrames()).toBe(0);
  });

  function setup(input: { isRunning: boolean }) {
    let now = 1000;
    let nextFrameId = 1;
    const frames = new Map<number, FrameRequestCallback>();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(nextFrameId, callback);
      return nextFrameId++;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    onTestFinished(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    const frameAt = (timestamp: number) => {
      now = timestamp;
      const due = [...frames.entries()];
      frames.clear();
      act(() => due.forEach(([, callback]) => callback(timestamp)));
    };

    const hook = renderHook(({ isRunning, restartKey }) => useSceneClock(isRunning, restartKey), {
      initialProps: { isRunning: input.isRunning, restartKey: "0" }
    });

    return { ...hook, frameAt, setNow: (timestamp: number) => (now = timestamp), pendingFrames: () => frames.size };
  }
});
