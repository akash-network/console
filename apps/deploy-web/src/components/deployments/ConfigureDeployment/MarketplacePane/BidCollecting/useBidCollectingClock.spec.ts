import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeploymentFlowPhase } from "../../useDeploymentFlow/useDeploymentFlow";
import { useBidCollectingClock } from "./useBidCollectingClock";

import { act, renderHook } from "@testing-library/react";

describe(useBidCollectingClock.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts the time since it started in tenths of a second", () => {
    const { result } = setup({ phase: "quoting" });

    act(() => vi.advanceTimersByTime(250));

    expect(result.current.msSinceStart).toBe(200);
  });

  it("starts counting the time since quoting along with the wait when the deployment already exists", () => {
    const { result } = setup({ phase: "quoting" });

    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.msSinceQuoting).toBe(1000);
  });

  it("counts the time since quoting from the moment the deployment is created", () => {
    const { result, rerender } = setup({ phase: "creating" });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.msSinceQuoting).toBeNull();

    rerender({ phase: "quoting", isRunning: true });
    act(() => vi.advanceTimersByTime(500));

    expect(result.current).toEqual({ msSinceStart: 2500, msSinceQuoting: 500 });
  });

  it("stops the clock once it no longer runs", () => {
    const { result, rerender } = setup({ phase: "quoting" });
    act(() => vi.advanceTimersByTime(300));

    rerender({ phase: "quoting", isRunning: false });
    act(() => vi.advanceTimersByTime(5000));

    expect(result.current.msSinceStart).toBe(300);
  });

  function setup(input: { phase: DeploymentFlowPhase }) {
    vi.useFakeTimers({ now: new Date("2026-10-12T12:00:00Z") });
    return renderHook(({ phase, isRunning }: { phase: DeploymentFlowPhase; isRunning: boolean }) => useBidCollectingClock(phase, isRunning), {
      initialProps: { phase: input.phase, isRunning: true }
    });
  }
});
