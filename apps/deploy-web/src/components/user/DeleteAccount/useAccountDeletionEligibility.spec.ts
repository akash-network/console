import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { Balances } from "@src/types";
import type { DEPENDENCIES } from "./useAccountDeletionEligibility";
import { useAccountDeletionEligibility, useWalletDeletionEligibility } from "./useAccountDeletionEligibility";

import { renderHook } from "@testing-library/react";

type ServerEligibility = NonNullable<ReturnType<typeof DEPENDENCIES.useAccountDeletionEligibilityQuery>["data"]>;

const GLOBEX = { id: "org-9", name: "Globex" };
const INITECH = { id: "org-7", name: "Initech" };

describe(useAccountDeletionEligibility.name, () => {
  it("waits for the balances to load", () => {
    const { result } = setup({ isLoading: true });

    expect(result.current).toEqual({ status: "loading" });
  });

  it("blocks an account with active deployments", () => {
    const { result } = setup({ activeDeploymentCount: 2, grantsUsd: 10 });

    expect(result.current).toEqual({ status: "blocked", activeDeploymentCount: 2, teamsWithDeployments: [] });
  });

  it("asks a paying user to forfeit the credits left in their grant", () => {
    const { result } = setup({ grantsUsd: 12.5 });

    expect(result.current).toEqual({ status: "forfeit", balanceUsd: 12.5, teamsDeletedWithAccount: [] });
  });

  it("asks a paying user with exactly one cent left to forfeit it", () => {
    const { result } = setup({ grantsUsd: 0.01 });

    expect(result.current).toEqual({ status: "forfeit", balanceUsd: 0.01, teamsDeletedWithAccount: [] });
  });

  it("ignores less than a cent of credits", () => {
    const { result } = setup({ grantsUsd: 0.004 });

    expect(result.current).toEqual({ status: "clean", teamsDeletedWithAccount: [] });
  });

  it("lets a trial user delete without forfeiting their trial credits", () => {
    const { result } = setup({ isTrialing: true, grantsUsd: 50 });

    expect(result.current).toEqual({ status: "clean", teamsDeletedWithAccount: [] });
  });

  it("treats an account whose balances have not been published yet as having nothing to forfeit", () => {
    const { result } = setup({ grantsUsd: null });

    expect(result.current).toEqual({ status: "clean", teamsDeletedWithAccount: [] });
  });

  it("treats an account without a wallet as having nothing to block on", () => {
    const { result, useBalances } = setup({ address: "", balances: null });

    expect(result.current).toEqual({ status: "clean", teamsDeletedWithAccount: [] });
    expect(useBalances).toHaveBeenCalledWith("");
  });

  it("leaves the API unasked while organizations are off", () => {
    const { useAccountDeletionEligibilityQuery } = setup({ grantsUsd: 0 });

    expect(useAccountDeletionEligibilityQuery).toHaveBeenCalledWith({ enabled: false });
  });

  describe("with organizations on", () => {
    it("waits for the API's answer rather than the wallet's", () => {
      const { result, useFlag, useAccountDeletionEligibilityQuery } = setup({ organizationsOn: true, grantsUsd: 12.5 });

      expect(result.current).toEqual({ status: "loading" });
      expect(useAccountDeletionEligibilityQuery).toHaveBeenCalledWith({ enabled: true });
      expect(useFlag).toHaveBeenCalledWith("organizations");
    });

    it("blocks on the running deployments of the account and of the teams going with it, naming those teams", () => {
      const { result } = setup({
        organizationsOn: true,
        server: {
          activeDeploymentCount: 3,
          teamsDeletedWithAccount: [
            { ...GLOBEX, activeDeploymentCount: 2, forfeitableBalanceUsd: 0 },
            { ...INITECH, activeDeploymentCount: 0, forfeitableBalanceUsd: 0 }
          ],
          teamsToTransfer: [INITECH]
        }
      });

      expect(result.current).toEqual({ status: "blocked", activeDeploymentCount: 3, teamsWithDeployments: [GLOBEX] });
    });

    it("asks for teams other people belong to to change hands first", () => {
      const { result } = setup({ organizationsOn: true, server: { forfeitableBalanceUsd: 4, teamsToTransfer: [GLOBEX] } });

      expect(result.current).toEqual({ status: "transfer", teamsToTransfer: [GLOBEX] });
    });

    it("asks to forfeit the summed credits once, with the teams going with the account", () => {
      const { result } = setup({
        organizationsOn: true,
        server: { forfeitableBalanceUsd: 0.01, teamsDeletedWithAccount: [{ ...GLOBEX, activeDeploymentCount: 0, forfeitableBalanceUsd: 0.01 }] }
      });

      expect(result.current).toEqual({ status: "forfeit", balanceUsd: 0.01, teamsDeletedWithAccount: [GLOBEX] });
    });

    it("lets an account with nothing to forfeit go, with the teams going with it", () => {
      const { result } = setup({
        organizationsOn: true,
        server: { forfeitableBalanceUsd: 0.004, teamsDeletedWithAccount: [{ ...GLOBEX, activeDeploymentCount: 0, forfeitableBalanceUsd: 0 }] }
      });

      expect(result.current).toEqual({ status: "clean", teamsDeletedWithAccount: [GLOBEX] });
    });

    it("falls back to the wallet when the API cannot answer", () => {
      const { result } = setup({ organizationsOn: true, isServerError: true, grantsUsd: 12.5 });

      expect(result.current).toEqual({ status: "forfeit", balanceUsd: 12.5, teamsDeletedWithAccount: [] });
    });
  });

  describe("for the active organization's wallet alone", () => {
    it("tells a team what it forfeits even while the account still has teams to hand over", () => {
      const { result, dependencies } = setup({ organizationsOn: true, grantsUsd: 12.5, server: { forfeitableBalanceUsd: 4, teamsToTransfer: [GLOBEX] } });

      const { result: walletResult } = renderHook(() => useWalletDeletionEligibility(dependencies));

      expect(result.current).toEqual({ status: "transfer", teamsToTransfer: [GLOBEX] });
      expect(walletResult.current).toEqual({ status: "forfeit", balanceUsd: 12.5 });
    });

    it("blocks a team on its own running deployments", () => {
      const { dependencies } = setup({ organizationsOn: true, activeDeploymentCount: 2, server: {} });

      const { result } = renderHook(() => useWalletDeletionEligibility(dependencies));

      expect(result.current).toEqual({ status: "blocked", activeDeploymentCount: 2 });
    });

    it("lets a team with nothing left go", () => {
      const { dependencies } = setup({ organizationsOn: true, server: { forfeitableBalanceUsd: 4 } });

      const { result } = renderHook(() => useWalletDeletionEligibility(dependencies));

      expect(result.current).toEqual({ status: "clean" });
    });
  });

  function setup(input: {
    address?: string;
    isTrialing?: boolean;
    isLoading?: boolean;
    activeDeploymentCount?: number;
    grantsUsd?: number | null;
    balances?: Balances | null;
    organizationsOn?: boolean;
    server?: Partial<ServerEligibility>;
    isServerError?: boolean;
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
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(() => input.organizationsOn ?? false);
    const serverEligibility: ServerEligibility | undefined = input.server && {
      activeDeploymentCount: 0,
      forfeitableBalanceUsd: 0,
      isTrialing: false,
      teamsDeletedWithAccount: [],
      teamsToTransfer: [],
      ...input.server
    };
    const serverQuery: Pick<ReturnType<typeof DEPENDENCIES.useAccountDeletionEligibilityQuery>, "data" | "isError"> = {
      data: serverEligibility,
      isError: input.isServerError ?? false
    };
    const useAccountDeletionEligibilityQuery = vi.fn<typeof DEPENDENCIES.useAccountDeletionEligibilityQuery>(
      () => serverQuery as ReturnType<typeof DEPENDENCIES.useAccountDeletionEligibilityQuery>
    );

    const dependencies: typeof DEPENDENCIES = { useWallet, useBalances, useWalletBalance, useFlag, useAccountDeletionEligibilityQuery };

    const { result } = renderHook(() => useAccountDeletionEligibility(dependencies));

    return { result, dependencies, useBalances, useFlag, useAccountDeletionEligibilityQuery };
  }
});
