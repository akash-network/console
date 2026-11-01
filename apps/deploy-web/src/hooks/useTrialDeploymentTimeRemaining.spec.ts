import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useTrialDeploymentTimeRemaining";
import { useTrialDeploymentTimeRemaining } from "./useTrialDeploymentTimeRemaining";

import { renderHook } from "@testing-library/react";

describe("useTrialTimeRemaining", () => {
  const mockDate = new Date("2024-01-01T12:00:00Z");

  it("should return default values when no data is available", () => {
    const { result } = setup({
      latestBlockHeight: undefined,
      createdHeight: 1000,
      trialDurationHours: 24,
      averageBlockTime: 6
    });

    expect(result.current.timeLeft).toBeNull();
    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeRemainingText).toBe("Calculating...");
  });

  it("should calculate time remaining for active trial", () => {
    const { result } = setup({
      latestBlockHeight: 1100,
      createdHeight: 1000,
      trialDurationHours: 24,
      averageBlockTime: 6
    });

    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeLeft).toBeInstanceOf(Date);
    expect(result.current.timeLeft!.getTime()).toBeGreaterThan(mockDate.getTime());
    expect(result.current.timeRemainingText).toContain("in");
  });

  it("should return expired status when trial has ended", () => {
    const trialDurationHours = 24;
    const averageBlockTime = 6;
    const totalTrialBlocks = trialDurationHours * (3600 / averageBlockTime); // 14400 blocks
    const currentHeight = 1000 + totalTrialBlocks + 100; // Past trial end

    const { result } = setup({
      latestBlockHeight: currentHeight,
      createdHeight: 1000,
      trialDurationHours,
      averageBlockTime
    });

    expect(result.current.isExpired).toBe(true);
    expect(result.current.timeLeft).toBeNull();
    expect(result.current.timeRemainingText).toBe("Trial expired");
  });

  it("should handle edge case where blocks remaining is exactly 0", () => {
    const trialDurationHours = 24;
    const averageBlockTime = 6;
    const totalTrialBlocks = trialDurationHours * (3600 / averageBlockTime); // 14400 blocks
    const currentHeight = 1000 + totalTrialBlocks; // Exactly at trial end

    const { result } = setup({
      latestBlockHeight: currentHeight,
      createdHeight: 1000,
      trialDurationHours,
      averageBlockTime
    });

    expect(result.current.isExpired).toBe(true);
    expect(result.current.timeLeft).toBeNull();
    expect(result.current.timeRemainingText).toBe("Trial expired");
  });

  it("should handle different block times correctly", () => {
    const { result } = setup({
      latestBlockHeight: 1100,
      createdHeight: 1000,
      trialDurationHours: 12,
      averageBlockTime: 12 // 12 seconds per block
    });

    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeLeft).toBeInstanceOf(Date);
    expect(result.current.timeRemainingText).toContain("in");
  });

  it("should handle very short trial durations", () => {
    const { result } = setup({
      latestBlockHeight: 1001,
      createdHeight: 1000,
      trialDurationHours: 1, // 1 hour trial
      averageBlockTime: 6
    });

    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeLeft).toBeInstanceOf(Date);
    expect(result.current.timeRemainingText).toContain("in");
  });

  it("should handle decimal block times", () => {
    const { result } = setup({
      latestBlockHeight: 1100,
      createdHeight: 1000,
      trialDurationHours: 24,
      averageBlockTime: 5.5 // 5.5 seconds per block
    });

    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeLeft).toBeInstanceOf(Date);
    expect(result.current.timeRemainingText).toContain("in");
  });

  it("should return calculating text when createdHeight is not provided", () => {
    const { result } = setup({
      latestBlockHeight: 1100,
      createdHeight: undefined
    });

    expect(result.current.timeLeft).toBeNull();
    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeRemainingText).toBeNull();
  });

  it("should return calculating text when trialDurationHours is not provided", () => {
    const { result } = setup({
      latestBlockHeight: 1100,
      createdHeight: 1000,
      trialDurationHours: undefined
    });

    expect(result.current.timeLeft).toBeNull();
    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeRemainingText).toBe("Calculating...");
  });

  function withTimers<T>(testFn: () => T): T {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    try {
      return testFn();
    } finally {
      vi.useRealTimers();
      vi.clearAllMocks();
    }
  }

  function setup(input: { latestBlockHeight: number | undefined; createdHeight?: number; trialDurationHours?: number; averageBlockTime?: number }) {
    return withTimers(() => {
      const useLatestBlockHeight = vi.fn<typeof DEPENDENCIES.useLatestBlockHeight>(() => input.latestBlockHeight);

      const { result } = renderHook(() =>
        useTrialDeploymentTimeRemaining({
          createdHeight: input.createdHeight,
          trialDurationHours: input.trialDurationHours,
          averageBlockTime: input.averageBlockTime,
          dependencies: { useLatestBlockHeight }
        })
      );

      return { result, useLatestBlockHeight };
    });
  }
});
