import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useIsOnboarded";
import { useIsOnboarded } from "@src/hooks/useIsOnboarded";

import { renderHook } from "@testing-library/react";

describe(useIsOnboarded.name, () => {
  it("returns true when the managed wallet has at least one lease", () => {
    const { result } = setup({ hasManagedWallet: true, address: "akash1abc", hasLease: true });

    expect(result.current).toBe(true);
  });

  it("returns false when the managed wallet has no lease and onboarding was not skipped", () => {
    const { result } = setup({ hasManagedWallet: true, address: "akash1abc", hasLease: false });

    expect(result.current).toBe(false);
  });

  it("returns false when the wallet has no address yet", () => {
    const { result } = setup({ hasManagedWallet: true, address: "", hasLease: true });

    expect(result.current).toBe(false);
  });

  it("returns false when there is no managed wallet and onboarding was not skipped", () => {
    const { result } = setup({ hasManagedWallet: false });

    expect(result.current).toBe(false);
  });

  it("returns true when onboarding was explicitly skipped even without a lease", () => {
    const { result } = setup({ hasManagedWallet: false, onboardingSkippedAt: "2026-07-30T00:00:00Z" });

    expect(result.current).toBe(true);
  });

  function setup(input?: { hasManagedWallet?: boolean; address?: string; hasLease?: boolean; onboardingSkippedAt?: string | null }) {
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        address: input?.address ?? "akash1abc",
        hasManagedWallet: input?.hasManagedWallet ?? false
      });
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        user: { onboardingSkippedAt: input?.onboardingSkippedAt ?? null }
      });
    const useLeaseExistenceQuery: typeof DEPENDENCIES.useLeaseExistenceQuery = () =>
      mock<ReturnType<typeof DEPENDENCIES.useLeaseExistenceQuery>>({ data: input?.hasLease ?? false });

    return renderHook(() => useIsOnboarded({ useWallet, useUser, useLeaseExistenceQuery }));
  }
});
