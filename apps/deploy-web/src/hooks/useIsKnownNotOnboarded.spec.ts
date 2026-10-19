import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useIsKnownNotOnboarded";
import { useIsKnownNotOnboarded } from "@src/hooks/useIsKnownNotOnboarded";
import type { OrganizationOutput } from "@src/types/organization";

import { renderHook } from "@testing-library/react";

describe(useIsKnownNotOnboarded.name, () => {
  it("returns true once the wallet's leases resolve to none", () => {
    const { result } = setup({ hasLease: false });

    expect(result.current).toBe(true);
  });

  it("returns true for a signed-in user without a managed wallet", () => {
    const { result } = setup({ hasWallet: false });

    expect(result.current).toBe(true);
  });

  it("returns true for a wallet whose address is not known yet", () => {
    const { result } = setup({ address: "" });

    expect(result.current).toBe(true);
  });

  it("returns false while the lease lookup has no answer", () => {
    const { result } = setup({ hasLease: undefined });

    expect(result.current).toBe(false);
  });

  it("returns false when the wallet has a lease", () => {
    const { result } = setup({ hasLease: true });

    expect(result.current).toBe(false);
  });

  it("returns false while the user is loading", () => {
    const { result } = setup({ isUserLoading: true });

    expect(result.current).toBe(false);
  });

  it("returns false while the organizations are loading", () => {
    const { result } = setup({ isOrganizationLoading: true });

    expect(result.current).toBe(false);
  });

  it("returns false when the organizations failed to load", () => {
    const { result } = setup({ organizationsErrored: true });

    expect(result.current).toBe(false);
  });

  it("returns false without a signed-in user", () => {
    const { result } = setup({ userId: null });

    expect(result.current).toBe(false);
  });

  it("returns false when onboarding was skipped", () => {
    const { result } = setup({ onboardingSkippedAt: "2026-07-30T00:00:00Z" });

    expect(result.current).toBe(false);
  });

  it("returns false in a team organization", () => {
    const { result } = setup({ organizationType: "team" });

    expect(result.current).toBe(false);
  });

  it("only looks up leases for a wallet with an address and keeps a settled answer on mount", () => {
    const { useLeaseExistenceQuery } = setup({ hasWallet: true, address: "akash1abc" });
    setup({ hasWallet: false, address: "akash1def", useLeaseExistenceQuery });

    expect(useLeaseExistenceQuery.mock.calls).toEqual([
      ["akash1abc", { enabled: true, refetchOnMount: false }],
      ["akash1def", { enabled: false, refetchOnMount: false }]
    ]);
  });

  function setup(input: {
    hasWallet?: boolean;
    address?: string;
    hasLease?: boolean | undefined;
    userId?: string | null;
    isUserLoading?: boolean;
    onboardingSkippedAt?: string | null;
    organizationType?: "personal" | "team";
    isOrganizationLoading?: boolean;
    organizationsErrored?: boolean;
    useLeaseExistenceQuery?: ReturnType<typeof vi.fn<typeof DEPENDENCIES.useLeaseExistenceQuery>>;
  }) {
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        address: input.address ?? "akash1abc",
        hasWallet: input.hasWallet ?? true
      });
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        user: input.userId === null ? undefined : { userId: input.userId ?? "user-1", onboardingSkippedAt: input.onboardingSkippedAt ?? null },
        isLoading: input.isUserLoading ?? false
      });
    const hasLease = "hasLease" in input ? input.hasLease : false;
    const useLeaseExistenceQuery =
      input.useLeaseExistenceQuery ??
      vi.fn<typeof DEPENDENCIES.useLeaseExistenceQuery>(() => mock<ReturnType<typeof DEPENDENCIES.useLeaseExistenceQuery>>({ data: hasLease }));
    const useActiveOrganization: typeof DEPENDENCIES.useActiveOrganization = () =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
        activeOrganization: mock<OrganizationOutput>({ type: input.organizationType ?? "personal" }),
        isLoading: input.isOrganizationLoading ?? false,
        isError: input.organizationsErrored ?? false
      });

    const rendered = renderHook(() => useIsKnownNotOnboarded({ useWallet, useUser, useLeaseExistenceQuery, useActiveOrganization }));
    return { ...rendered, useLeaseExistenceQuery };
  }
});
