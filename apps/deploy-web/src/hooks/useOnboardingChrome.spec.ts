import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useOnboardingChrome";
import { useOnboardingChrome } from "@src/hooks/useOnboardingChrome";
import type { AppError } from "@src/types";

import { renderHook } from "@testing-library/react";

describe(useOnboardingChrome.name, () => {
  it("strips chrome when onboarding on the configure route with the flag on", () => {
    const { dependencies } = setup({ isFlagEnabled: true, pathname: "/new-deployment/configure", isOnboarding: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: true, isResolving: false });
  });

  it("matches nested configure routes via startsWith", () => {
    const { dependencies } = setup({ isFlagEnabled: true, pathname: "/new-deployment/configure/1234", isOnboarding: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current.isStripped).toBe(true);
  });

  it("does not strip on plain /new-deployment", () => {
    const { dependencies } = setup({ isFlagEnabled: true, pathname: "/new-deployment", isOnboarding: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false, isResolving: false });
  });

  it("does nothing when the flag is off", () => {
    const { dependencies } = setup({ isFlagEnabled: false, pathname: "/new-deployment/configure", isOnboarding: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false, isResolving: false });
  });

  it("does nothing on an unrelated route", () => {
    const { dependencies } = setup({ isFlagEnabled: true, pathname: "/deployments/1234", isOnboarding: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false, isResolving: false });
  });

  it("resolves while the wallet query is loading", () => {
    const { dependencies } = setup({ isFlagEnabled: true, pathname: "/new-deployment/configure", isOnboarding: false, isWalletLoading: true });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false, isResolving: true });
  });

  it("resolves while the trial wallet has not appeared yet", () => {
    const { dependencies } = setup({ isFlagEnabled: true, pathname: "/new-deployment/configure", isOnboarding: false, hasManagedWallet: false });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false, isResolving: true });
  });

  it("stops resolving and shows full chrome for a converted user", () => {
    const { dependencies } = setup({
      isFlagEnabled: true,
      pathname: "/new-deployment/configure",
      isOnboarding: false,
      isWalletLoading: false,
      hasManagedWallet: true
    });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false, isResolving: false });
  });

  it("stops resolving and shows full chrome when the wallet errors", () => {
    const { dependencies } = setup({
      isFlagEnabled: true,
      pathname: "/new-deployment/configure",
      isOnboarding: false,
      hasManagedWallet: false,
      managedWalletError: mock<AppError>()
    });

    const { result } = renderHook(() => useOnboardingChrome(dependencies));

    expect(result.current).toEqual({ isStripped: false, isResolving: false });
  });

  function setup(input: {
    isFlagEnabled: boolean;
    pathname: string;
    isOnboarding: boolean;
    isWalletLoading?: boolean;
    hasManagedWallet?: boolean;
    managedWalletError?: AppError;
  }) {
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        isOnboarding: input.isOnboarding,
        isWalletLoading: input.isWalletLoading ?? false,
        hasManagedWallet: input.hasManagedWallet ?? true,
        managedWalletError: input.managedWalletError
      });
    const usePathname: typeof DEPENDENCIES.usePathname = () => input.pathname;
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isFlagEnabled;

    return { dependencies: { useWallet, usePathname, useFlag } };
  }
});
