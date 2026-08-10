import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useEnsureTrialStarted";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";

import { renderHook } from "@testing-library/react";

describe(useEnsureTrialStarted.name, () => {
  it("is ready once the managed wallet has an address", () => {
    const { dependencies } = setup({ wallet: { address: "akash1..." }, isInitializing: false });

    const { result } = renderHook(() => useEnsureTrialStarted(dependencies));

    expect(result.current.isWalletReady).toBe(true);
  });

  it("is not ready while the wallet row exists without an address yet", () => {
    const { dependencies } = setup({ wallet: { address: null }, isInitializing: false });

    const { result } = renderHook(() => useEnsureTrialStarted(dependencies));

    expect(result.current.isWalletReady).toBe(false);
  });

  it("is not ready and reports loading when there is no wallet", () => {
    const { dependencies } = setup({ wallet: undefined, isInitializing: true });

    const { result } = renderHook(() => useEnsureTrialStarted(dependencies));

    expect(result.current.isWalletReady).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  function setup(input: { wallet: { address: string | null } | undefined; isInitializing: boolean }) {
    const useManagedWallet: typeof DEPENDENCIES.useManagedWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedWallet>>({
        wallet: input.wallet as ReturnType<typeof DEPENDENCIES.useManagedWallet>["wallet"],
        isInitializing: input.isInitializing
      });

    return { dependencies: { useManagedWallet } };
  }
});
