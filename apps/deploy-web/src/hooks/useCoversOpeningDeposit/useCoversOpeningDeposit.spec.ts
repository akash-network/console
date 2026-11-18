import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { DEPENDENCIES } from "./useCoversOpeningDeposit";
import { useCoversOpeningDeposit } from "./useCoversOpeningDeposit";

import { renderHook } from "@testing-library/react";

describe(useCoversOpeningDeposit.name, () => {
  it("covers the deposit when the balance holds more than it", () => {
    const { result } = setup({ grantsUsd: 20 });

    expect(result.current).toBe(true);
  });

  it("covers the deposit when the balance matches it exactly", () => {
    const { result } = setup({ grantsUsd: 0.5 });

    expect(result.current).toBe(true);
  });

  it("does not cover the deposit when the balance holds less than it", () => {
    const { result } = setup({ grantsUsd: 0.49 });

    expect(result.current).toBe(false);
  });

  it("does not cover the deposit when the balance is spent", () => {
    const { result } = setup({ grantsUsd: 0 });

    expect(result.current).toBe(false);
  });

  it("compares against the deposit the api is configured with", () => {
    const { result } = setup({ grantsUsd: 0.75, defaultDepositUsd: 1 });

    expect(result.current).toBe(false);
  });

  it("does not cover the deposit while the balance is still loading", () => {
    const { result } = setup({ grantsUsd: null });

    expect(result.current).toBe(false);
  });

  it("does not cover the deposit while the funding config is still loading", () => {
    const { result } = setup({ grantsUsd: 20, defaultDepositUsd: null });

    expect(result.current).toBe(false);
  });

  function setup(input: { grantsUsd: number | null; defaultDepositUsd?: number | null }) {
    const defaultDepositUsd = input.defaultDepositUsd === undefined ? 0.5 : input.defaultDepositUsd;
    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>(), {
        balance: input.grantsUsd === null ? null : Object.assign(mock<WalletBalance>(), { totalDeploymentGrantsUSD: input.grantsUsd })
      });
    const useDeploymentFundingConfigQuery: typeof DEPENDENCIES.useDeploymentFundingConfigQuery = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentFundingConfigQuery>>(), {
        data: defaultDepositUsd === null ? undefined : { targetRunwayHours: 48, balanceHeadroomUsd: 5, defaultDepositUsd }
      });

    return renderHook(() => useCoversOpeningDeposit({ dependencies: { useWalletBalance, useDeploymentFundingConfigQuery } }));
  }
});
