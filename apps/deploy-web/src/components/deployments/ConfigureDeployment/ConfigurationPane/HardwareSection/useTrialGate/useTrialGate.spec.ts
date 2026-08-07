import { describe, expect, it } from "vitest";

import { useTrialGate } from "./useTrialGate";

import { renderHook } from "@testing-library/react";
import { buildWallet } from "@tests/seeders";

describe("useTrialGate", () => {
  it("restricts while the user is trialing", () => {
    const { result } = setup({ isTrialing: true, hasWallet: true });
    expect(result.current.isRestricted).toBe(true);
  });

  it("restricts while the wallet is not ready", () => {
    const { result } = setup({ isTrialing: false, hasWallet: false });
    expect(result.current.isRestricted).toBe(true);
  });

  it("does not restrict a ready, non-trial wallet", () => {
    const { result } = setup({ isTrialing: false, hasWallet: true });
    expect(result.current.isRestricted).toBe(false);
  });

  it("reports wallet readiness from hasWallet", () => {
    expect(setup({ isTrialing: true, hasWallet: true }).result.current.isWalletReady).toBe(true);
    expect(setup({ isTrialing: true, hasWallet: false }).result.current.isWalletReady).toBe(false);
  });

  function setup(input: { isTrialing: boolean; hasWallet: boolean }) {
    const useWallet = () => buildWallet({ isTrialing: input.isTrialing, hasWallet: input.hasWallet });
    return renderHook(() => useTrialGate({ useWallet }));
  }
});
