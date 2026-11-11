import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { type DEPENDENCIES, useHasTrialRefusedBanner } from "./useHasTrialRefusedBanner";

import { renderHook } from "@testing-library/react";

describe(useHasTrialRefusedBanner.name, () => {
  it("shows for a wallet whose free trial was refused", () => {
    const { result } = setup({ wallet: mock<ApiManagedWalletOutput>({ isTrialRefused: true }) });

    expect(result.current).toBe(true);
  });

  it("hides for a wallet whose free trial was not refused", () => {
    const { result } = setup({ wallet: mock<ApiManagedWalletOutput>({ isTrialRefused: false }) });

    expect(result.current).toBe(false);
  });

  it("hides while there is no wallet", () => {
    const { result } = setup({ wallet: undefined });

    expect(result.current).toBe(false);
  });

  function setup(input: { wallet: ApiManagedWalletOutput | undefined }) {
    const useManagedWallet: typeof DEPENDENCIES.useManagedWallet = () => mock<ReturnType<typeof DEPENDENCIES.useManagedWallet>>({ wallet: input.wallet });

    return renderHook(() => useHasTrialRefusedBanner({ useManagedWallet }));
  }
});
