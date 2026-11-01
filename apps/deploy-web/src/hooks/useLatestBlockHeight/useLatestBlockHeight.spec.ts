import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ObservedBlockHeight } from "@src/context/BlockchainStatusProvider/BlockchainStatusProvider";
import type { DEPENDENCIES } from "./useLatestBlockHeight";
import { useLatestBlockHeight } from "./useLatestBlockHeight";

import { act, renderHook } from "@testing-library/react";

const NOW = new Date("2026-10-31T12:00:00Z").getTime();
const BLOCK_TIME_MS = 6_098;

describe(useLatestBlockHeight.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers the height the status poll saw when no block time has passed since", () => {
    const { result } = setup({ latestBlock: { height: 1000, observedAt: NOW } });

    expect(result.current).toBe(1000);
  });

  it("adds one block for each average block time elapsed since the height was seen", () => {
    const { result } = setup({ latestBlock: { height: 1000, observedAt: NOW - 10 * BLOCK_TIME_MS - 1 } });

    expect(result.current).toBe(1010);
  });

  it("moves on every 30 seconds while enabled", () => {
    const { result } = setup({ latestBlock: { height: 1000, observedAt: NOW } });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current).toBe(1004);
  });

  it("never counts back when the height arrived after the last tick", () => {
    const { result } = setup({ latestBlock: { height: 1000, observedAt: NOW + 60_000 } });

    expect(result.current).toBe(1000);
  });

  it("answers nothing until the status poll has reported a height", () => {
    const { result } = setup({ latestBlock: null });

    expect(result.current).toBeUndefined();
  });

  it("answers nothing and stops ticking while disabled", () => {
    const { result } = setup({ latestBlock: { height: 1000, observedAt: NOW }, enabled: false });

    expect(result.current).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("catches up to the current time as soon as it is enabled", () => {
    const { result, rerender } = setup({ latestBlock: { height: 1000, observedAt: NOW }, enabled: false });

    act(() => {
      vi.advanceTimersByTime(10 * BLOCK_TIME_MS);
    });
    rerender({ enabled: true });

    expect(result.current).toBe(1010);
  });

  it("stops ticking once unmounted", () => {
    const { unmount } = setup({ latestBlock: { height: 1000, observedAt: NOW } });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  function setup(input: { latestBlock: ObservedBlockHeight | null; enabled?: boolean }) {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const useBlockchainStatus: typeof DEPENDENCIES.useBlockchainStatus = () =>
      mock<ReturnType<typeof DEPENDENCIES.useBlockchainStatus>>({ isBlockchainDown: false, latestBlock: input.latestBlock });

    return renderHook(({ enabled }) => useLatestBlockHeight({ enabled }, { useBlockchainStatus }), { initialProps: { enabled: input.enabled } });
  }
});
