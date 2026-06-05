import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { DayRepository } from "@src/gpu/repositories/day.repository";
import { DenomExchangeService } from "./denom-exchange.service";

describe(DenomExchangeService.name, () => {
  describe("getExchangeRateToUSD", () => {
    it("returns oracle price data", async () => {
      const { service, getAggregatedPriceV2, getPricesV2 } = setup({});

      const result = await service.getExchangeRateToUSD("akt");

      expect(getAggregatedPriceV2).toHaveBeenCalled();
      expect(getPricesV2).toHaveBeenCalled();
      expect(result).toEqual({
        price: 0.56,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0.56 - 0.5,
        priceChangePercentage24: ((0.56 - 0.5) / 0.5) * 100
      });
    });

    it("queries the V2 price history over a window inside the 24h retention", async () => {
      const { service, getPricesV2 } = setup({});

      await service.getExchangeRateToUSD("akt");

      expect(getPricesV2).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            assetDenom: "akt",
            baseDenom: "usd",
            startTime: expect.any(Date),
            endTime: expect.any(Date)
          })
        })
      );
      const { startTime, endTime } = getPricesV2.mock.calls[0][0].filters;
      const windowMs = endTime.getTime() - startTime.getTime();
      expect(windowMs).toBe(23 * 60 * 60 * 1000);
      expect(windowMs).toBeLessThan(24 * 60 * 60 * 1000);
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

    it("keeps the V2 price when the 24h history query fails", async () => {
      const { service, getAggregatedPriceV1, getLatestBlock, logger } = setup({ v2HistoryThrows: true });

      const result = await service.getExchangeRateToUSD("akt");

      expect(result.price).toBe(0.56);
      expect(result.priceChange24h).toBe(0);
      expect(result.priceChangePercentage24).toBe(0);
      expect(getAggregatedPriceV1).not.toHaveBeenCalled();
      expect(getLatestBlock).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_V2_PRICE_HISTORY_UNAVAILABLE" }));
    });

    it("falls back to V1 when the V2 query service is unavailable", async () => {
      const { service, getAggregatedPriceV2, getAggregatedPriceV1, getPricesV1, logger } = setup({ v2Unavailable: true, currentHeight: 100000n });

      const result = await service.getExchangeRateToUSD("akt");

      expect(getAggregatedPriceV2).toHaveBeenCalled();
      expect(getAggregatedPriceV1).toHaveBeenCalled();
      expect(getPricesV1).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ height: 100000n - (24n * 60n * 60n) / 6n })
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_V2_UNAVAILABLE_FALLBACK_V1" }));
      expect(result.price).toBe(0.56);
    });

    it("does not fall back to V1 on a non-Unimplemented V2 error", async () => {
      const { service, getAggregatedPriceV1, getLatestBlock, dayRepository, logger } = setup({ v2TransientError: true, latestAktPrice: 1.5 });

      const result = await service.getExchangeRateToUSD("akt");

      expect(getAggregatedPriceV1).not.toHaveBeenCalled();
      expect(getLatestBlock).not.toHaveBeenCalled();
      expect(dayRepository.getLatestAktPrice).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_RPC_FAILED" }));
      expect(result.price).toBe(1.5);
    });

    it("caches the V2-unavailable decision and skips V2 on subsequent calls", async () => {
      const { service, getAggregatedPriceV2, getAggregatedPriceV1 } = setup({ v2Unavailable: true });

      await service.getExchangeRateToUSD("akt");
      await service.getExchangeRateToUSD("akash-network");

      expect(getAggregatedPriceV2).toHaveBeenCalledTimes(1);
      expect(getAggregatedPriceV1).toHaveBeenCalledTimes(2);
    });

    it("falls back to DB price when oracle reports unhealthy", async () => {
      const { service, dayRepository, logger, getAggregatedPriceV1 } = setup({ isHealthy: false, latestAktPrice: 1.23 });

      const result = await service.getExchangeRateToUSD("akt");

      expect(dayRepository.getLatestAktPrice).toHaveBeenCalled();
      expect(getAggregatedPriceV1).not.toHaveBeenCalled();
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

    it("falls back to DB price when both oracle versions fail", async () => {
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
    v2Unavailable?: boolean;
    v2TransientError?: boolean;
    v2HistoryThrows?: boolean;
    latestAktPrice?: number | null;
  }) {
    const getLatestBlock = vi.fn().mockResolvedValue({
      block: { header: { height: { toBigInt: () => input.currentHeight ?? 1000000n } } }
    });
    const aggregatedPriceResponse = {
      aggregatedPrice: { medianPrice: "0.56" },
      priceHealth: { isHealthy: input.isHealthy ?? true }
    };
    const pricesResponse = {
      prices: input.emptyHistoricalPrices ? [] : [{ state: { price: input.historicalPrice ?? "0.5" } }]
    };

    const getAggregatedPriceV2 = vi.fn().mockResolvedValue(aggregatedPriceResponse);
    const getPricesV2 = vi.fn().mockResolvedValue(pricesResponse);
    const getAggregatedPriceV1 = vi.fn().mockResolvedValue(aggregatedPriceResponse);
    const getPricesV1 = vi.fn().mockResolvedValue(pricesResponse);

    if (input.v2Unavailable) {
      // gRPC Unimplemented (HTTP 501): the node hasn't registered the V2 query service yet.
      getAggregatedPriceV2.mockRejectedValue(makeTransportError(12));
    }
    if (input.v2TransientError) {
      // Any non-Unimplemented V2 error must NOT trigger the V1 fallback.
      getAggregatedPriceV2.mockRejectedValue(makeTransportError(14));
    }
    if (input.v2HistoryThrows) {
      getPricesV2.mockRejectedValue(new Error("price history pruned"));
    }
    if (input.oracleThrows) {
      // V2 is unimplemented (-> tries V1) and V1 also fails, so the service falls through to CoinGecko.
      getAggregatedPriceV2.mockRejectedValue(makeTransportError(12));
      getLatestBlock.mockRejectedValue(new Error("RPC connection refused"));
    }

    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock.mockImplementation(getLatestBlock);
    chainSdk.akash.oracle.v2.getAggregatedPrice.mockImplementation(getAggregatedPriceV2);
    chainSdk.akash.oracle.v2.getPrices.mockImplementation(getPricesV2);
    chainSdk.akash.oracle.v1.getAggregatedPrice.mockImplementation(getAggregatedPriceV1);
    chainSdk.akash.oracle.v1.getPrices.mockImplementation(getPricesV1);

    const dayRepository = mock<DayRepository>();
    dayRepository.getLatestAktPrice.mockResolvedValue("latestAktPrice" in input ? input.latestAktPrice! : 1.23);

    const logger = mock<LoggerService>();

    const service = new DenomExchangeService(chainSdk, dayRepository, logger);

    return { service, getLatestBlock, getAggregatedPriceV2, getPricesV2, getAggregatedPriceV1, getPricesV1, dayRepository, logger };
  }

  // Mirrors a chain-sdk TransportError (gRPC code 12 = Unimplemented for an unregistered method).
  function makeTransportError(code: number) {
    return Object.assign(new Error(`transport error ${code}`), { name: "TransportError", code });
  }
});
