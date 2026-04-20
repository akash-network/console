import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { DayRepository } from "@src/gpu/repositories/day.repository";
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

    it("falls back to DB price when oracle reports unhealthy", async () => {
      const { service, dayRepository, logger } = setup({ isHealthy: false, latestAktPrice: 1.23 });

      const result = await service.getExchangeRateToUSD("akt");

      expect(dayRepository.getLatestAktPrice).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_PRICE_UNHEALTHY" }));
      expect(result).toEqual({
        price: 1.23,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0,
        priceChangePercentage24: 0
      });
    });

    it("falls back to DB price when oracle RPC fails", async () => {
      const { service, dayRepository, logger } = setup({ oracleThrows: true, latestAktPrice: 0.99 });

      const result = await service.getExchangeRateToUSD("akt");

      expect(dayRepository.getLatestAktPrice).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_RPC_FAILED" }));
      expect(result).toEqual({
        price: 0.99,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0,
        priceChangePercentage24: 0
      });
    });

    it("returns zero price when oracle fails and DB has no price", async () => {
      const { service, logger } = setup({ oracleThrows: true, latestAktPrice: null });

      const result = await service.getExchangeRateToUSD("akt");

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_RPC_FAILED" }));
      expect(result).toEqual({
        price: 0,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0,
        priceChangePercentage24: 0
      });
    });
  });

  function setup(input: {
    currentHeight?: bigint;
    historicalPrice?: string;
    emptyHistoricalPrices?: boolean;
    isHealthy?: boolean;
    oracleThrows?: boolean;
    latestAktPrice?: number | null;
  }) {
    const getLatestBlock = vi.fn().mockResolvedValue({
      block: { header: { height: { toBigInt: () => input.currentHeight ?? 1000000n } } }
    });
    const getAggregatedPrice = vi.fn().mockResolvedValue({
      aggregatedPrice: { medianPrice: "0.56" },
      priceHealth: { isHealthy: input.isHealthy ?? true }
    });
    const getPrices = vi.fn().mockResolvedValue({
      prices: input.emptyHistoricalPrices ? [] : [{ state: { price: input.historicalPrice ?? "0.5" } }]
    });

    if (input.oracleThrows) {
      getLatestBlock.mockRejectedValue(new Error("RPC connection refused"));
    }

    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock.mockImplementation(getLatestBlock);
    chainSdk.akash.oracle.v1.getAggregatedPrice.mockImplementation(getAggregatedPrice);
    chainSdk.akash.oracle.v1.getPrices.mockImplementation(getPrices);

    const dayRepository = mock<DayRepository>();
    dayRepository.getLatestAktPrice.mockResolvedValue("latestAktPrice" in input ? input.latestAktPrice : 1.23);

    const logger = mock<LoggerService>();

    const service = new DenomExchangeService(chainSdk, dayRepository, logger);

    return { service, getLatestBlock, getAggregatedPrice, getPrices, dayRepository, logger };
  }
});
