import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { Balances } from "@src/types";
import type { DEPENDENCIES } from "./useAccountDeletionEligibility";
import { useAccountDeletionEligibility } from "./useAccountDeletionEligibility";

import { renderHook } from "@testing-library/react";

describe(useAccountDeletionEligibility.name, () => {
  it("waits for the balances to load", () => {
    const { result } = setup({ isLoading: true });

    expect(result.current).toEqual({ status: "loading" });
  });

  it("blocks an account with active deployments", () => {
    const { result } = setup({ activeDeploymentCount: 2, grantsUsd: 10 });

    expect(result.current).toEqual({ status: "blocked", activeDeploymentCount: 2 });
  });

  it("asks a paying user to forfeit the credits left in their grant", () => {
    const { result } = setup({ grantsUsd: 12.5 });

    expect(result.current).toEqual({ status: "forfeit", balanceUsd: 12.5 });
  });

  it("asks a paying user with exactly one cent left to forfeit it", () => {
    const { result } = setup({ grantsUsd: 0.01 });

    expect(result.current).toEqual({ status: "forfeit", balanceUsd: 0.01 });
  });

  it("ignores less than a cent of credits", () => {
    const { result } = setup({ grantsUsd: 0.004 });

    expect(result.current).toEqual({ status: "clean" });
  });

  it("lets a trial user delete without forfeiting their trial credits", () => {
    const { result } = setup({ isTrialing: true, grantsUsd: 50 });

    expect(result.current).toEqual({ status: "clean" });
  });

  it("treats an account whose balances have not been published yet as having nothing to forfeit", () => {
    const { result } = setup({ grantsUsd: null });

    expect(result.current).toEqual({ status: "clean" });
  });

  it("treats an account without a wallet as having nothing to block on", () => {
    const { result, useBalances } = setup({ address: "", balances: null });

    expect(result.current).toEqual({ status: "clean" });
    expect(useBalances).toHaveBeenCalledWith("");
  });

  function setup(input: {
    address?: string;
    isTrialing?: boolean;
    isLoading?: boolean;
    activeDeploymentCount?: number;
    grantsUsd?: number | null;
    balances?: Balances | null;
  }) {
    const address = input.address ?? "akash1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq7cdc78";
    const balances =
      input.balances === undefined
        ? mock<Balances>({ activeDeployments: Array.from({ length: input.activeDeploymentCount ?? 0 }, () => mock<Balances["activeDeployments"][number]>()) })
        : input.balances;
    const balance = input.grantsUsd === null ? null : mock<WalletBalance>({ totalDeploymentGrantsUSD: input.grantsUsd ?? 0 });

    const useWallet = (() =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address, isTrialing: input.isTrialing ?? false })) as typeof DEPENDENCIES.useWallet;
    const balancesQuery: Pick<ReturnType<typeof DEPENDENCIES.useBalances>, "data" | "isLoading"> = { data: balances, isLoading: input.isLoading ?? false };
    const useBalances = vi.fn<typeof DEPENDENCIES.useBalances>(() => balancesQuery as ReturnType<typeof DEPENDENCIES.useBalances>);
    const walletBalance = mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({ balance });
    const useWalletBalance = (() => walletBalance) as typeof DEPENDENCIES.useWalletBalance;

    const { result } = renderHook(() => useAccountDeletionEligibility({ useWallet, useBalances, useWalletBalance }));

    return { result, useBalances };
  }
});
