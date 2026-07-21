import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useOnboardingChrome";
import { useOnboardingChrome } from "@src/hooks/useOnboardingChrome";
import type { AppError } from "@src/types";

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

  it("strips and renders while the wallet query is still loading instead of holding a spinner", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", leaseCount: 0, isWalletLoading: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: true });
  });

  it("strips and renders while the trial wallet is still provisioning instead of holding a spinner", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", leaseCount: 0, hasManagedWallet: false });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: true });
  });

  it("strips and renders while the leases query is still loading instead of holding a spinner", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", isLeasesLoading: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: true });
  });

  it("shows full chrome when the wallet errors", () => {
    const { dependencies } = setup({
      pathname: "/new-deployment/configure",
      leaseCount: 0,
      hasManagedWallet: false,
      managedWalletError: mock<AppError>()
    });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false });
  });

  it("shows full chrome when the leases query errors for an existing wallet", () => {
    const { dependencies } = setup({ pathname: "/new-deployment/configure", isLeasesError: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false });
  });

  function setup(input: {
    pathname: string;
    leaseCount?: number;
    isLeasesLoading?: boolean;
    isLeasesError?: boolean;
    isWalletLoading?: boolean;
    hasManagedWallet?: boolean;
    managedWalletError?: AppError;
  }) {
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        address: "akash1test",
        isWalletLoading: input.isWalletLoading ?? false,
        hasManagedWallet: input.hasManagedWallet ?? true,
        managedWalletError: input.managedWalletError
      });
    const usePathname: typeof DEPENDENCIES.usePathname = () => input.pathname;
    const useAllLeases = (() =>
      mock<ReturnType<typeof DEPENDENCIES.useAllLeases>>({
        isLoading: (input.isLeasesLoading ?? false) as never,
        isError: (input.isLeasesError ?? false) as never,
        data: (input.isLeasesError ? undefined : Array.from({ length: input.leaseCount ?? 0 })) as never
      })) as typeof DEPENDENCIES.useAllLeases;

    return { dependencies: { useWallet, usePathname, useAllLeases } };
  }
});
