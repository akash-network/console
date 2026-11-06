import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { AssistantUsdService } from "./assistant-usd.service";

describe(AssistantUsdService.name, () => {
  describe("usdOf", () => {
    it("converts uact to dollars at a million uact to the dollar, rounded to cents", async () => {
      const { service, denomExchangeService } = setup();

      expect(await service.usdOf([{ denom: "uact", amount: 99_497_947 }])).toBe(99.5);
      expect(denomExchangeService.getExchangeRateToUSD).not.toHaveBeenCalled();
    });

    it("sums coins of every denom it can price, converting uakt at the AKT rate", async () => {
      const { service, denomExchangeService } = setup({ aktPrice: 0.5 });

      expect(
        await service.usdOf([
          { denom: "uact", amount: "1000000" },
          { denom: "uakt", amount: "3000000" }
        ])
      ).toBe(2.5);
      expect(denomExchangeService.getExchangeRateToUSD).toHaveBeenCalledWith("akt");
    });

    it("reports nothing as zero dollars", async () => {
      const { service } = setup();

      expect(await service.usdOf([])).toBe(0);
    });

    it("reports no amount when a denom has no known dollar rate", async () => {
      const { service } = setup();

      expect(
        await service.usdOf([
          { denom: "uact", amount: "1000000" },
          { denom: "ibc/usdc", amount: "1000000" }
        ])
      ).toBeNull();
    });

    it("reports no amount for uakt while the AKT rate is unavailable", async () => {
      const { service } = setup({ aktPrice: 0 });

      expect(await service.usdOf([{ denom: "uakt", amount: "1000000" }])).toBeNull();
    });
  });

  describe("usdPerMonthOf", () => {
    it("converts per-block prices to dollars over a month of 6 second blocks", async () => {
      const { service } = setup({ aktPrice: 2 });

      expect(await service.usdPerMonthOf([{ denom: "uact", amount: "2.93" }])).toBe(1.28);
      expect(await service.usdPerMonthOf([{ denom: "uakt", amount: "1" }])).toBe(0.88);
    });

    it("reports no monthly cost for a denom it cannot price", async () => {
      const { service } = setup();

      expect(await service.usdPerMonthOf([{ denom: "ibc/usdc", amount: "1" }])).toBeNull();
    });
  });

  function setup(input: { aktPrice?: number } = {}) {
    const denomExchangeService = mock<DenomExchangeService>();
    denomExchangeService.getExchangeRateToUSD.mockResolvedValue({
      price: input.aktPrice ?? 1,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    });
    const service = new AssistantUsdService(denomExchangeService);

    return { service, denomExchangeService };
  }
});
