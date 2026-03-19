import { describe, expect, it } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import type { DEPENDENCIES } from "./useManagedWalletDenom";
import { useManagedWalletDenom } from "./useManagedWalletDenom";

import { renderHook } from "@testing-library/react";

describe(useManagedWalletDenom.name, () => {
  it("returns uakt for self-custody wallet", () => {
    const { result } = renderHook(() => useManagedWalletDenom(buildDependencies({ isManaged: false })));

    expect(result.current).toBe(UAKT_DENOM);
  });

  it("returns managed wallet denom when available", () => {
    const { result } = renderHook(() => useManagedWalletDenom(buildDependencies({ isManaged: true, managedWalletDenom: "uakt" })));

    expect(result.current).toBe("uakt");
  });

  it("returns uact for managed wallet without denom when ACT is supported", () => {
    const { result } = renderHook(() => useManagedWalletDenom(buildDependencies({ isManaged: true, supportsACT: true })));

    expect(result.current).toBe(UACT_DENOM);
  });

  it("returns usdc for managed wallet without denom when ACT is not supported", () => {
    const usdcDenom = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
    const { result } = renderHook(() => useManagedWalletDenom(buildDependencies({ isManaged: true, supportsACT: false, usdcDenom })));

    expect(result.current).toBe(usdcDenom);
  });

  function buildDependencies(input: { isManaged: boolean; managedWalletDenom?: string; supportsACT?: boolean; usdcDenom?: string }) {
    return {
      useWallet: () => ({ isManaged: input.isManaged }) as ReturnType<typeof DEPENDENCIES.useWallet>,
      useManagedWallet: () =>
        ({
          wallet: input.managedWalletDenom ? { denom: input.managedWalletDenom } : undefined
        }) as ReturnType<typeof DEPENDENCIES.useManagedWallet>,
      useUsdcDenom: () => input.usdcDenom ?? "ibc/test-usdc",
      useSupportsACT: () => input.supportsACT ?? false
    } as typeof DEPENDENCIES;
  }
});
