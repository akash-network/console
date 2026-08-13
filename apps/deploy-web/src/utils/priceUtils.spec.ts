import { describe, expect, it } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { averageBlockTime, getLeasesCostPerBlockUsd, perBlockToHourly } from "./priceUtils";

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
