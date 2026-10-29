import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { DEPENDENCIES } from "./useIsOutOfDeployCredit";
import { useIsOutOfDeployCredit } from "./useIsOutOfDeployCredit";

import { renderHook } from "@testing-library/react";

const ADDRESS = "akash1trialwallet";

describe(useIsOutOfDeployCredit.name, () => {
  it("reports no credit when a paid account holds less than the opening deposit", () => {
    const { result } = setup({ isTrialing: false, grantsUsd: 0.49 });

    expect(result.current).toBe(true);
  });

  it("reports no credit when a paid account has nothing left", () => {
    const { result } = setup({ isTrialing: false, grantsUsd: 0 });

    expect(result.current).toBe(true);
  });

  it("reports credit when the balance covers the opening deposit exactly", () => {
    const { result } = setup({ isTrialing: false, grantsUsd: 0.5 });

    expect(result.current).toBe(false);
  });

  it("reports credit when an account holds paid credits", () => {
    const { result } = setup({ isTrialing: false, grantsUsd: 20 });

    expect(result.current).toBe(false);
  });

  it("compares against the opening deposit the api is configured with", () => {
    const { result } = setup({ isTrialing: false, grantsUsd: 0.75, defaultDepositUsd: 1 });

    expect(result.current).toBe(true);
  });

  it("reports credit while the balance is still loading", () => {
    const { result } = setup({ isTrialing: false, grantsUsd: null });

    expect(result.current).toBe(false);
  });

  it("reports credit while the funding config is still loading", () => {
    const { result } = setup({ isTrialing: false, grantsUsd: 0, defaultDepositUsd: null });

    expect(result.current).toBe(false);
  });

  it("reports no credit when an open trial with its grants in place has spent them", () => {
    const { result } = setup({ isTrialing: true, grantsUsd: 0, hasFeeAllowance: true });

    expect(result.current).toBe(true);
  });

  it("reports credit when an open trial has no fee allowance yet because it is still being provisioned", () => {
    const { result } = setup({ isTrialing: true, grantsUsd: 0, hasFeeAllowance: false });

    expect(result.current).toBe(false);
  });

  it("reports credit while the fee allowance of an empty open trial is still loading", () => {
    const { result } = setup({ isTrialing: true, grantsUsd: 0, hasFeeAllowance: undefined });

    expect(result.current).toBe(false);
  });

  it("reports no credit when the trial has expired, whatever its fee allowance", () => {
    const { result } = setup({ isTrialing: true, isTrialExpired: true, grantsUsd: 0, hasFeeAllowance: false });

    expect(result.current).toBe(true);
  });

  it("looks up the fee allowance of the wallet only when an open trial is short of the opening deposit", () => {
    const { useFeeAllowanceExistenceQuery } = setup({ isTrialing: true, grantsUsd: 0 });

    expect(useFeeAllowanceExistenceQuery).toHaveBeenCalledWith(ADDRESS, { enabled: true });
  });

  it("skips the fee allowance lookup when an open trial still covers the opening deposit", () => {
    const { useFeeAllowanceExistenceQuery } = setup({ isTrialing: true, grantsUsd: 1 });

    expect(useFeeAllowanceExistenceQuery).toHaveBeenCalledWith(ADDRESS, { enabled: false });
  });

  it("skips the fee allowance lookup for an expired trial", () => {
    const { useFeeAllowanceExistenceQuery } = setup({ isTrialing: true, isTrialExpired: true, grantsUsd: 0 });

    expect(useFeeAllowanceExistenceQuery).toHaveBeenCalledWith(ADDRESS, { enabled: false });
  });

  it("skips the fee allowance lookup for a paid account", () => {
    const { useFeeAllowanceExistenceQuery } = setup({ isTrialing: false, grantsUsd: 0 });

    expect(useFeeAllowanceExistenceQuery).toHaveBeenCalledWith(ADDRESS, { enabled: false });
  });

  function setup(input: {
    isTrialing: boolean;
    isTrialExpired?: boolean;
    grantsUsd: number | null;
    defaultDepositUsd?: number | null;
    hasFeeAllowance?: boolean;
  }) {
    const defaultDepositUsd = input.defaultDepositUsd === undefined ? 0.5 : input.defaultDepositUsd;
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: ADDRESS, isTrialing: input.isTrialing });
    const useTrialStatus: typeof DEPENDENCIES.useTrialStatus = () =>
      mock<ReturnType<typeof DEPENDENCIES.useTrialStatus>>({ isExpired: input.isTrialExpired ?? false });
    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>(), {
        balance: input.grantsUsd === null ? null : Object.assign(mock<WalletBalance>(), { totalDeploymentGrantsUSD: input.grantsUsd })
      });
    const useDeploymentFundingConfigQuery: typeof DEPENDENCIES.useDeploymentFundingConfigQuery = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentFundingConfigQuery>>(), {
        data: defaultDepositUsd === null ? undefined : { targetRunwayHours: 48, balanceHeadroomUsd: 5, defaultDepositUsd }
      });
    const useFeeAllowanceExistenceQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useFeeAllowanceExistenceQuery>>(), {
        data: input.hasFeeAllowance
      })) satisfies typeof DEPENDENCIES.useFeeAllowanceExistenceQuery);

    const { result } = renderHook(() =>
      useIsOutOfDeployCredit({
        dependencies: {
          useWallet,
          useTrialStatus,
          useWalletBalance,
          useDeploymentFundingConfigQuery,
          useFeeAllowanceExistenceQuery
        }
      })
    );

    return { result, useFeeAllowanceExistenceQuery };
  }
});
