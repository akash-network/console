import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import addDays from "date-fns/addDays";
import addHours from "date-fns/addHours";
import subDays from "date-fns/subDays";
import subHours from "date-fns/subHours";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useTrialStatus";
import { useTrialStatus } from "./useTrialStatus";

import { renderHook } from "@testing-library/react";

describe(useTrialStatus.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the days left until the trial expires", () => {
    const { result } = setup({ trialEndsAt: addDays(new Date(), 12) });

    expect(result.current.daysLeft).toBe(12);
    expect(result.current.isExpired).toBe(false);
  });

  it("keeps a trial expiring later the same day running", () => {
    const now = pinClockTo(new Date(2026, 5, 5, 9, 0, 0));

    const { result } = setup({ trialEndsAt: addHours(now, 6) });

    expect(result.current.daysLeft).toBe(1);
    expect(result.current.isExpired).toBe(false);
  });

  it("marks the trial expired once its timestamp has passed", () => {
    const now = pinClockTo(new Date(2026, 5, 5, 9, 0, 0));

    const { result } = setup({ trialEndsAt: subHours(now, 1) });

    expect(result.current.daysLeft).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it("clamps an elapsed trial to zero days left", () => {
    const { result } = setup({ trialEndsAt: subDays(new Date(), 3) });

    expect(result.current.daysLeft).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it("drains the bar in step with the days left", () => {
    const { result } = setup({ trialEndsAt: addDays(new Date(), 15), totalDays: 30 });

    expect(result.current.daysRemainingPercent).toBe(50);
  });

  it("keeps the bar full while the expiry is still unknown", () => {
    const { result } = setup({ trialEndsAt: null });

    expect(result.current.daysRemainingPercent).toBe(100);
  });

  it("leaves the countdown unknown when the wallet reports no expiry", () => {
    const { result } = setup({ trialEndsAt: null });

    expect(result.current.daysLeft).toBeNull();
    expect(result.current.isExpired).toBe(false);
  });

  function pinClockTo(now: Date) {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    return now;
  }

  function setup(input: { trialEndsAt: Date | null; totalDays?: number; isTrialing?: boolean }) {
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? true });

    const useManagedWallet: typeof DEPENDENCIES.useManagedWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedWallet>>({
        wallet: mock<ApiManagedWalletOutput>({ trialEndsAt: input.trialEndsAt ? input.trialEndsAt.toISOString() : null })
      });

    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: mock<ReturnType<typeof DEPENDENCIES.useServices>["publicConfig"]>({
          NEXT_PUBLIC_TRIAL_DURATION_DAYS: input.totalDays ?? 30,
          NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS: 24
        })
      });

    return renderHook(() => useTrialStatus({ dependencies: { useWallet, useManagedWallet, useServices } }));
  }
});
