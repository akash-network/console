import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UACT_DENOM } from "@src/config/denom.config";
import type { Balances } from "@src/types";
import type { DeploymentDto } from "@src/types/deployment";
import { udenomToDenom } from "@src/utils/mathHelpers";
import type { LIVE_ESCROW_DEPENDENCIES, LiveEscrowInput } from "./useWalletBalance";
import { computeWalletBalance, useLiveEscrow } from "./useWalletBalance";

import { renderHook } from "@testing-library/react";

describe(computeWalletBalance.name, () => {
  it("reports the settled escrow when no live escrow input is given", () => {
    const { balances, udenomToUsd } = setup({ fundsUact: 10_000_000, settledAt: 1000 });

    const balance = computeWalletBalance(balances, 0, udenomToUsd);

    expect(balance.totalDeploymentEscrowUSD).toBeCloseTo(10, 6);
    expect(balance.totalUsd).toBeCloseTo(10, 6);
  });

  it("nets off what the provider earned since the escrow last settled", () => {
    const { balances, udenomToUsd, liveEscrow } = setup({
      fundsUact: 10_000_000,
      settledAt: 1000,
      latestBlockHeight: 1100,
      perBlockUsd: 0.02
    });

    const balance = computeWalletBalance(balances, 0, udenomToUsd, liveEscrow);

    expect(balance.totalDeploymentEscrowUSD).toBeCloseTo(8, 6);
    expect(balance.totalUsd).toBeCloseTo(8, 6);
  });

  it("keeps the liquid balance out of the accrual", () => {
    const { balances, udenomToUsd, liveEscrow } = setup({
      fundsUact: 10_000_000,
      balanceUact: 5_000_000,
      settledAt: 1000,
      latestBlockHeight: 1100,
      perBlockUsd: 0.02
    });

    const balance = computeWalletBalance(balances, 0, udenomToUsd, liveEscrow);

    expect(balance.totalUsd).toBeCloseTo(13, 6);
  });

  it("reports the settled escrow for a deployment with no live lease", () => {
    const { balances, udenomToUsd, liveEscrow } = setup({
      fundsUact: 10_000_000,
      settledAt: 1000,
      latestBlockHeight: 1100
    });

    const balance = computeWalletBalance(balances, 0, udenomToUsd, liveEscrow);

    expect(balance.totalDeploymentEscrowUSD).toBeCloseTo(10, 6);
  });

  function setup(input: { fundsUact: number; balanceUact?: number; settledAt: number; latestBlockHeight?: number; perBlockUsd?: number }) {
    const dseq = "1";
    const balances = Object.assign(mock<Balances>(), {
      balanceUAKT: 0,
      balanceUUSDC: 0,
      balanceUACT: input.balanceUact ?? 0,
      activeDeployments: [
        mock<DeploymentDto>({
          dseq,
          escrowAccount: mock<DeploymentDto["escrowAccount"]>({
            state: mock<DeploymentDto["escrowAccount"]["state"]>({
              settled_at: String(input.settledAt),
              funds: [{ denom: UACT_DENOM, amount: String(input.fundsUact) }]
            })
          })
        })
      ],
      deploymentGrants: []
    });

    const liveEscrow: LiveEscrowInput = {
      latestBlockHeight: input.latestBlockHeight,
      perBlockUsdByDseq: new Map(input.perBlockUsd ? [[dseq, input.perBlockUsd]] : [])
    };

    return { balances, liveEscrow, udenomToUsd: (amount: string | number, denom: string) => (denom === UACT_DENOM ? udenomToDenom(amount, 6) : 0) };
  }
});

describe(useLiveEscrow.name, () => {
  it("asks for neither the spend rate nor the latest block while the wallet holds no escrow", () => {
    const { useSpendRateQuery, useBlock } = setup({ activeDseqs: [] });

    expect(useSpendRateQuery).toHaveBeenCalledWith({ enabled: false });
    expect(useBlock).toHaveBeenCalledWith("latest", expect.objectContaining({ enabled: false }));
  });

  it("asks for the spend rate and the latest block once the wallet holds an escrow", () => {
    const { useSpendRateQuery, useBlock } = setup({ activeDseqs: ["1"] });

    expect(useSpendRateQuery).toHaveBeenCalledWith({ enabled: true });
    expect(useBlock).toHaveBeenCalledWith("latest", expect.objectContaining({ enabled: true }));
  });

  it("waits for a wallet address before asking for the spend rate", () => {
    const { useSpendRateQuery } = setup({ activeDseqs: ["1"], address: "" });

    expect(useSpendRateQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("hands on what each deployment costs per block alongside the latest height", () => {
    const { result } = setup({ activeDseqs: ["1"], perBlockUsdByDseq: { "1": 0.02 }, latestBlockHeight: 1100 });

    expect(result.current.latestBlockHeight).toBe(1100);
    expect(Object.fromEntries(result.current.perBlockUsdByDseq)).toEqual({ "1": 0.02 });
  });

  it("reports no spend and no height before either has loaded", () => {
    const { result } = setup({ activeDseqs: ["1"] });

    expect(result.current.latestBlockHeight).toBeUndefined();
    expect(result.current.perBlockUsdByDseq.size).toBe(0);
  });

  function setup(input: { activeDseqs: string[]; address?: string; perBlockUsdByDseq?: Record<string, number>; latestBlockHeight?: number }) {
    const balances = Object.assign(mock<Balances>(), {
      activeDeployments: input.activeDseqs.map(dseq => mock<DeploymentDto>({ dseq }))
    });

    const spendRateQuery = Object.assign(mock<ReturnType<typeof LIVE_ESCROW_DEPENDENCIES.useSpendRateQuery>>(), {
      data: input.perBlockUsdByDseq ? new Map(Object.entries(input.perBlockUsdByDseq)) : undefined
    });
    const useSpendRateQuery = vi.fn<typeof LIVE_ESCROW_DEPENDENCIES.useSpendRateQuery>(() => spendRateQuery);

    const blockQuery = Object.assign(mock<ReturnType<typeof LIVE_ESCROW_DEPENDENCIES.useBlock>>(), {
      data: input.latestBlockHeight === undefined ? undefined : { block: { header: { height: String(input.latestBlockHeight) } } }
    });
    const useBlock = vi.fn<typeof LIVE_ESCROW_DEPENDENCIES.useBlock>(() => blockQuery);

    const hook = renderHook(() => useLiveEscrow(input.address ?? "akash1abc", balances, { useSpendRateQuery, useBlock }));

    return { ...hook, useSpendRateQuery, useBlock };
  }
});
