import { describe, expect, it } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { averageBlockTime, getLeaseCostPerBlockUsdByDseq, getLeasesCostPerBlockUsd, getLiveEscrowBalance, perBlockToHourly } from "./priceUtils";

describe("perBlockToHourly", () => {
  it("converts a per-block price into its hourly equivalent (3600 / blockTime blocks per hour)", () => {
    expect(perBlockToHourly(1)).toBeCloseTo(3600 / averageBlockTime, 6);
    expect(perBlockToHourly(0)).toBe(0);
  });
});

describe(getLeasesCostPerBlockUsd.name, () => {
  it("sums ACT lease prices as 1:1 USD", () => {
    const leases = [{ price: { denom: UACT_DENOM, amount: "500000" } }, { price: { denom: UACT_DENOM, amount: "500000" } }];

    expect(getLeasesCostPerBlockUsd(leases)).toBeCloseTo(1, 6);
  });

  it("ignores AKT and USDC leases since deployments are funded in ACT", () => {
    const leases = [{ price: { denom: UAKT_DENOM, amount: "5000000000" } }, { price: { denom: "ibc/usdc", amount: "5000000000" } }];

    expect(getLeasesCostPerBlockUsd(leases)).toBe(0);
  });
});

describe(getLeaseCostPerBlockUsdByDseq.name, () => {
  it("sums every lease of a deployment under its dseq", () => {
    const leases = [
      { dseq: "1", price: { denom: UACT_DENOM, amount: "500000" } },
      { dseq: "1", price: { denom: UACT_DENOM, amount: "500000" } },
      { dseq: "2", price: { denom: UACT_DENOM, amount: "250000" } }
    ];

    const perBlockUsdByDseq = getLeaseCostPerBlockUsdByDseq(leases);

    expect(perBlockUsdByDseq.get("1")).toBeCloseTo(1, 6);
    expect(perBlockUsdByDseq.get("2")).toBeCloseTo(0.25, 6);
  });

  it("has no entry for a deployment without leases", () => {
    expect(getLeaseCostPerBlockUsdByDseq([]).get("1")).toBeUndefined();
  });
});

describe(getLiveEscrowBalance.name, () => {
  it("subtracts what the provider earned since the escrow last settled", () => {
    expect(getLiveEscrowBalance({ settledBalance: 100, pricePerBlock: 0.5, settledAt: 1000, latestBlockHeight: 1100 })).toBeCloseTo(50, 6);
  });

  it("returns the settled balance when the escrow settled at the current height", () => {
    expect(getLiveEscrowBalance({ settledBalance: 100, pricePerBlock: 0.5, settledAt: 1100, latestBlockHeight: 1100 })).toBe(100);
  });

  it("returns the settled balance when no live lease is spending", () => {
    expect(getLiveEscrowBalance({ settledBalance: 100, pricePerBlock: 0, settledAt: 1000, latestBlockHeight: 1100 })).toBe(100);
  });

  it("returns the settled balance when the latest block height is unknown", () => {
    expect(getLiveEscrowBalance({ settledBalance: 100, pricePerBlock: 0.5, settledAt: 1000 })).toBe(100);
  });

  it("returns the settled balance when the settled height cannot be parsed", () => {
    expect(getLiveEscrowBalance({ settledBalance: 100, pricePerBlock: 0.5, settledAt: NaN, latestBlockHeight: 1100 })).toBe(100);
  });

  it("clamps to zero once the accrued spend exceeds the settled balance", () => {
    expect(getLiveEscrowBalance({ settledBalance: 10, pricePerBlock: 0.5, settledAt: 1000, latestBlockHeight: 1100 })).toBe(0);
  });

  it("never adds funds when the escrow settled ahead of a stale cached height", () => {
    expect(getLiveEscrowBalance({ settledBalance: 100, pricePerBlock: 0.5, settledAt: 1100, latestBlockHeight: 1000 })).toBe(100);
  });
});
