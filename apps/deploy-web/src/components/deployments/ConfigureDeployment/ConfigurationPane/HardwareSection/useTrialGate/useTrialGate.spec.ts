import { describe, expect, it } from "vitest";

import { useTrialGate } from "./useTrialGate";

import { renderHook } from "@testing-library/react";
import { buildWallet } from "@tests/seeders";

describe("useTrialGate", () => {
  it("restricts while the user is trialing", () => {
    const { result } = setup({ isTrialing: true, hasManagedWallet: true });
    expect(result.current.isRestricted).toBe(true);
  });

  it("restricts while the managed wallet is not ready", () => {
    const { result } = setup({ isTrialing: false, hasManagedWallet: false });
    expect(result.current.isRestricted).toBe(true);
  });

  it("does not restrict a ready, non-trial wallet", () => {
    const { result } = setup({ isTrialing: false, hasManagedWallet: true });
    expect(result.current.isRestricted).toBe(false);
  });

  it("reports wallet readiness from hasManagedWallet", () => {
    expect(setup({ isTrialing: true, hasManagedWallet: true }).result.current.isWalletReady).toBe(true);
    expect(setup({ isTrialing: true, hasManagedWallet: false }).result.current.isWalletReady).toBe(false);
  });

  function setup(input: { isTrialing: boolean; hasManagedWallet: boolean }) {
    const useWallet = () => buildWallet({ isTrialing: input.isTrialing, hasManagedWallet: input.hasManagedWallet });
    return renderHook(() => useTrialGate({ useWallet }));
  }
});
