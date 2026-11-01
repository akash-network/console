import { SANDBOX_ID } from "@akashnetwork/chain-sdk/web";
import type { NetworkStore } from "@akashnetwork/network-store";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UACT_DENOM, UAKT_DENOM, USDC_IBC_DENOMS } from "@src/config/denom.config";
import { useBalances } from "./useBalancesQuery";

import { waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const USDC_DENOM = USDC_IBC_DENOMS[SANDBOX_ID]!;

describe(useBalances.name, () => {
  it("totals the wallet's balances, escrow and grants per denom of the selected network", async () => {
    const { result } = setup({
      walletBalances: {
        balances: [
          { denom: UAKT_DENOM, amount: "100" },
          { denom: UACT_DENOM, amount: "250.5" },
          { denom: USDC_DENOM, amount: "40" }
        ],
        deploymentGrants: [
          { denom: UACT_DENOM, amount: "30" },
          { denom: UAKT_DENOM, amount: "7" }
        ],
        activeDeployments: [
          { dseq: "1", escrow: { funds: [{ denom: UACT_DENOM, amount: "10" }], settledAt: 900 } },
          {
            dseq: "2",
            escrow: {
              funds: [
                { denom: UACT_DENOM, amount: "5" },
                { denom: USDC_DENOM, amount: "2" }
              ],
              settledAt: 950
            }
          }
        ]
      }
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      balanceUAKT: 100,
      balanceUACT: 250.5,
      balanceUUSDC: 40,
      deploymentEscrowUAKT: 0,
      deploymentEscrowUACT: 15,
      deploymentEscrowUUSDC: 2,
      deploymentGrantsUAKT: 7,
      deploymentGrantsUACT: 30,
      deploymentGrantsUUSDC: 0
    });
  });

  it("hands on each escrowed deployment and grant as the API reports them", async () => {
    const activeDeployments = [{ dseq: "1", escrow: { funds: [{ denom: UACT_DENOM, amount: "10" }], settledAt: 900 } }];
    const deploymentGrants = [{ denom: UACT_DENOM, amount: "30" }];
    const { result } = setup({ walletBalances: { balances: [], deploymentGrants, activeDeployments } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.activeDeployments).toEqual(activeDeployments);
    expect(result.current.data?.deploymentGrants).toEqual(deploymentGrants);
  });

  it("counts an amount it cannot parse as nothing", async () => {
    const { result } = setup({
      walletBalances: {
        balances: [{ denom: UACT_DENOM, amount: "not-a-number" }],
        deploymentGrants: [],
        activeDeployments: []
      }
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.balanceUACT).toBe(0);
  });

  it("loads when called without options", async () => {
    const { result } = setup({});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("does not load without a wallet address", () => {
    const { result, getWalletBalances } = setup({ address: "" });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getWalletBalances).not.toHaveBeenCalled();
  });

  it("does not load while disabled", () => {
    const { result, getWalletBalances } = setup({ enabled: false });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getWalletBalances).not.toHaveBeenCalled();
  });

  function setup(input: {
    address?: string;
    enabled?: boolean;
    walletBalances?: {
      balances: { denom: string; amount: string }[];
      deploymentGrants: { denom: string; amount: string }[];
      activeDeployments: { dseq: string; escrow: { funds: { denom: string; amount: string }[]; settledAt: number } }[];
    };
  }) {
    const getWalletBalances = vi.fn().mockResolvedValue({ data: input.walletBalances ?? { balances: [], deploymentGrants: [], activeDeployments: [] } });
    const api = createProxy({ v1: { getWalletBalances } }) as unknown as ApiService;

    const { result } = setupQuery(() => useBalances(input.address ?? "akash1owner", input.enabled === undefined ? undefined : { enabled: input.enabled }), {
      services: {
        api: () => api,
        networkStore: () => mock<NetworkStore>({ selectedNetworkId: SANDBOX_ID })
      }
    });

    return { result, getWalletBalances };
  }
});
