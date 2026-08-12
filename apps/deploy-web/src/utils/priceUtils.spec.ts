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
  const usdcDenom = "ibc/usdc";

  it("sums USDC and ACT lease prices as 1:1 USD", () => {
    const leases = [{ price: { denom: usdcDenom, amount: "500000" } }, { price: { denom: UACT_DENOM, amount: "500000" } }];

    expect(getLeasesCostPerBlockUsd(leases, usdcDenom)).toBeCloseTo(1, 6);
  });

  it("ignores AKT-denominated leases since AKT deployments no longer exist", () => {
    const leases = [{ price: { denom: UAKT_DENOM, amount: "5000000000" } }];

    expect(getLeasesCostPerBlockUsd(leases, usdcDenom)).toBe(0);
  });
});
