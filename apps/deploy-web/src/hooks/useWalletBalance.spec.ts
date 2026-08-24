import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { UACT_DENOM } from "@src/config/denom.config";
import type { Balances } from "@src/types";
import type { DeploymentDto } from "@src/types/deployment";
import { udenomToDenom } from "@src/utils/mathHelpers";
import type { LiveEscrowInput } from "./useWalletBalance";
import { computeWalletBalance } from "./useWalletBalance";

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
