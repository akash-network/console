import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { type DEPENDENCIES, useHasFundingBanner } from "./useHasFundingBanner";

import { renderHook } from "@testing-library/react";

describe(useHasFundingBanner.name, () => {
  it("shows for a signed-in, trialing user once the wallet has loaded", () => {
    const { result } = setup({ userId: "user-1", isTrialing: true, isWalletLoading: false });

    expect(result.current).toBe(true);
  });

  it("hides when the user is not signed in", () => {
    const { result } = setup({ userId: undefined, isTrialing: true, isWalletLoading: false });

    expect(result.current).toBe(false);
  });

  it("hides while the wallet is still loading", () => {
    const { result } = setup({ userId: "user-1", isTrialing: true, isWalletLoading: true });

    expect(result.current).toBe(false);
  });

  it("hides once the user has funded (no longer trialing)", () => {
    const { result } = setup({ userId: "user-1", isTrialing: false, isWalletLoading: false });

    expect(result.current).toBe(false);
  });

  it("hides inside the stripped onboarding deploy funnel (configure page for a first-time user)", () => {
    const { result } = setup({ userId: "user-1", isTrialing: true, isWalletLoading: false, isStripped: true });

    expect(result.current).toBe(false);
  });

  function setup(input: { userId?: string; isTrialing: boolean; isWalletLoading: boolean; isStripped?: boolean }) {
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        user: input.userId ? mock<NonNullable<ReturnType<typeof DEPENDENCIES.useUser>["user"]>>({ id: input.userId }) : undefined
      });
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        isTrialing: input.isTrialing,
        isWalletLoading: input.isWalletLoading
      });
    const useOnboardingChrome: typeof DEPENDENCIES.useOnboardingChrome = () =>
      mock<ReturnType<typeof DEPENDENCIES.useOnboardingChrome>>({ isStripped: input.isStripped ?? false });

    return renderHook(() => useHasFundingBanner({ useUser, useWallet, useOnboardingChrome }));
  }
});
