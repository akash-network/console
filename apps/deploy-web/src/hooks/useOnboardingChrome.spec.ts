import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useOnboardingChrome";
import { useOnboardingChrome } from "@src/hooks/useOnboardingChrome";
import type { CustomUserProfile } from "@src/types/user";

import { renderHook } from "@testing-library/react";

describe(useOnboardingChrome.name, () => {
  it("strips chrome for a not-yet-onboarded user on the configure route", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", leaseCount: 0 });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: true });
  });

  it("matches nested configure routes via startsWith", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure/1234", leaseCount: 0 });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current.isStripped).toBe(true);
  });

  it("shows full chrome for an already-onboarded user creating another deployment, even on a trial", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", leaseCount: 1 });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false });
  });

  it("does not strip on plain /new-deployment", () => {
    const { dependencies } = setup({ pathname: "/new-deployment", leaseCount: 0 });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false });
  });

  it("does nothing on an unrelated route", () => {
    const { dependencies } = setup({ pathname: "/deployments/1234", leaseCount: 0 });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false });
  });

  it("strips and renders while the trial wallet is still provisioning instead of holding a spinner", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", leaseCount: 0, hasWallet: false });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: true });
  });

  it("strips and renders while the leases query is still loading instead of holding a spinner", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", isLeasesLoading: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: true });
  });

  it("shows full chrome when the leases query errors for an existing wallet", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", isLeasesError: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false });
  });

  it("shows full chrome for a user who has skipped onboarding, even on the configure route with no leases", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", leaseCount: 0, onboardingSkippedAt: "2026-07-27T00:00:00.000Z" });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false });
  });

  function setup(input: {
    pathname: string;
    leaseCount?: number;
    isLeasesLoading?: boolean;
    isLeasesError?: boolean;
    hasWallet?: boolean;
    onboardingSkippedAt?: string | null;
  }) {
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        address: "akash1test",
        hasWallet: input.hasWallet ?? true
      });
    const usePathname: typeof DEPENDENCIES.usePathname = () => input.pathname;
    const useLeaseExistenceQuery = (() =>
      mock<ReturnType<typeof DEPENDENCIES.useLeaseExistenceQuery>>({
        isLoading: (input.isLeasesLoading ?? false) as never,
        isError: (input.isLeasesError ?? false) as never,
        data: (input.isLeasesError ? undefined : (input.leaseCount ?? 0) > 0) as never
      })) as typeof DEPENDENCIES.useLeaseExistenceQuery;
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        user: mock<CustomUserProfile>({ onboardingSkippedAt: input.onboardingSkippedAt ?? null })
      });

    return { dependencies: { useWallet, usePathname, useLeaseExistenceQuery, useUser } };
  }
});
