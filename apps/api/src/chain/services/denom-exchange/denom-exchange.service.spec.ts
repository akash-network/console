import { describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { DenomExchangeService } from "./denom-exchange.service";

describe(DenomExchangeService.name, () => {
  describe("getExchangeRateToUSD", () => {
    it("returns oracle price data", async () => {
      const { service, getAggregatedPrice, getPrices } = setup({});

      const result = await service.getExchangeRateToUSD("akt");

      expect(getAggregatedPrice).toHaveBeenCalled();
      expect(getPrices).toHaveBeenCalled();
      expect(result).toEqual({
        price: 0.56,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0.56 - 0.5,
        priceChangePercentage24: ((0.56 - 0.5) / 0.5) * 100
      });
    });

    it("calculates block height 24h ago for historical price lookup", async () => {
      const { service, getPrices } = setup({ currentHeight: 100000n });

      await service.getExchangeRateToUSD("akt");

      const expectedHeight = 100000n - (24n * 60n * 60n) / 6n;
      expect(getPrices).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ height: expectedHeight })
        })
      );
    });

    it("returns zero price change when historical price is zero", async () => {
      const { service } = setup({ historicalPrice: "0" });

      const result = await service.getExchangeRateToUSD("akt");

      expect(result.priceChange24h).toBe(0.56);
      expect(result.priceChangePercentage24).toBe(0);
    });

    it("returns zero price change when no historical prices available", async () => {
      const { service } = setup({ emptyHistoricalPrices: true });

      const result = await service.getExchangeRateToUSD("akt");

      expect(result.priceChange24h).toBe(0);
      expect(result.priceChangePercentage24).toBe(0);
    });
  });

  function setup(input: { currentHeight?: bigint; historicalPrice?: string; emptyHistoricalPrices?: boolean }) {
    const getLatestBlock = vi.fn().mockResolvedValue({
      block: { header: { height: { toBigInt: () => input.currentHeight ?? 1000000n } } }
    });
    const getAggregatedPrice = vi.fn().mockResolvedValue({
      aggregatedPrice: { medianPrice: "0.56" }
    });
    const getPrices = vi.fn().mockResolvedValue({
      prices: input.emptyHistoricalPrices ? [] : [{ state: { price: input.historicalPrice ?? "0.5" } }]
    });

    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock.mockImplementation(getLatestBlock);
    chainSdk.akash.oracle.v1.getAggregatedPrice.mockImplementation(getAggregatedPrice);
    chainSdk.akash.oracle.v1.getPrices.mockImplementation(getPrices);

    const service = new DenomExchangeService(chainSdk);

    return { service, getLatestBlock, getAggregatedPrice, getPrices };
  }
});
