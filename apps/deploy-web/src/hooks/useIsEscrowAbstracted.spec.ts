import { describe, expect, it } from "vitest";

import { type DEPENDENCIES, useIsEscrowAbstracted } from "./useIsEscrowAbstracted";

import { renderHook } from "@testing-library/react";

describe(useIsEscrowAbstracted.name, () => {
  it("abstracts escrow once the platform owns the deposit and the funding-mode control is live", () => {
    const { result } = setup({ isDepositManagedByPlatform: true, hasFundingModeControl: true });

    expect(result.current).toBe(true);
  });

  it("keeps the escrow controls while the funding-mode control that replaces them is off", () => {
    const { result } = setup({ isDepositManagedByPlatform: true, hasFundingModeControl: false });

    expect(result.current).toBe(false);
  });

  it("keeps the escrow controls while the deposit is still the user's to manage", () => {
    const { result } = setup({ isDepositManagedByPlatform: false, hasFundingModeControl: true });

    expect(result.current).toBe(false);
  });

  it("keeps the escrow controls when neither side has rolled out", () => {
    const { result } = setup({ isDepositManagedByPlatform: false, hasFundingModeControl: false });

    expect(result.current).toBe(false);
  });

  function setup(input: { isDepositManagedByPlatform: boolean; hasFundingModeControl: boolean }) {
    const useFlag: typeof DEPENDENCIES.useFlag = flag =>
      flag === "auto_reload_fixed_threshold" ? input.isDepositManagedByPlatform : input.hasFundingModeControl;

    return renderHook(() => useIsEscrowAbstracted({ useFlag }));
  }
});
