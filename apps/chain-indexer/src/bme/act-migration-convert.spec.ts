import { describe, expect, it } from "vitest";

import {
  conversionBankContribution,
  convertDeploymentAmounts,
  convertLeaseAmounts,
  convertPriceAmount,
  parseRate,
  RATE_ONE
} from "@src/bme/act-migration-convert";

/** The rate the sandbox drain actually used at block 2552660: the price published at 2552658. */
const SANDBOX_RATE = parseRate("0.626310480000000000");

describe("act-migration-convert", () => {
  describe("parseRate", () => {
    it("rejects zero and negative rates", () => {
      expect(() => parseRate("0")).toThrow("Invalid AKT/USD rate");
      expect(() => parseRate("-1.5")).toThrow("Invalid AKT/USD rate");
    });
  });

  describe("convertPriceAmount", () => {
    it("scales a Dec price by the rate, reproducing the on-chain group price conversion", () => {
      expect(convertPriceAmount("1000", SANDBOX_RATE)).toBe("626.31048");
    });

    it("is exact at rate one, so the axlUSDC pass changes nothing", () => {
      expect(convertPriceAmount("626.310480000000000001", RATE_ONE)).toBe("626.310480000000000001");
    });
  });

  describe("convertDeploymentAmounts", () => {
    it("scales Dec columns and truncates the integer deposit like the chain's Coin conversion", () => {
      const converted = convertDeploymentAmounts({ balance: "5000000.5", deposit: "5000000", withdrawnAmount: "1000000", blockRate: "1000" }, SANDBOX_RATE);

      expect(converted).toEqual({
        balance: "3131552.71315524",
        deposit: "3131552",
        withdrawnAmount: "626310.48",
        blockRate: "626.31048"
      });
    });

    it("converts negative overdrawn balances too, matching the chain", () => {
      const converted = convertDeploymentAmounts({ balance: "-100", deposit: "0", withdrawnAmount: "0", blockRate: "0" }, SANDBOX_RATE);

      expect(converted.balance).toBe("-62.631048");
    });
  });

  describe("convertLeaseAmounts", () => {
    it("scales price and balance as Decs and the withdrawn amount as a truncated integer Coin", () => {
      const converted = convertLeaseAmounts({ price: "1000", balance: "500.5", withdrawnAmount: "999999" }, SANDBOX_RATE);

      expect(converted.price).toBe("626.31048");
      expect(converted.balance).toBe("313.46839524");
      expect(converted.withdrawnAmount).toBe("626309");
    });
  });

  describe("conversionBankContribution", () => {
    it("truncates the deployment's summed funds and payment balances once, like the chain's per-deployment TruncateDecimal", () => {
      const contribution = conversionBankContribution({ balance: "100.7", leaseBalances: ["10.5"] }, SANDBOX_RATE);

      expect(contribution.burned).toBe(111n);
      expect(contribution.minted).toBe(69n);
    });

    it("excludes negative balances from the burn and mint totals but keeps non-negative ones", () => {
      const contribution = conversionBankContribution({ balance: "-5", leaseBalances: ["10", "-3"] }, RATE_ONE);

      expect(contribution).toEqual({ burned: 10n, minted: 10n });
    });
  });
});
