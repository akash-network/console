import type { CoinGeckoHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { BlockchainCapabilitiesService } from "../blockchain-capabilities/blockchain-capabilities.service";
import { DenomExchangeService } from "./denom-exchange.service";

describe(DenomExchangeService.name, () => {
  describe("getExchangeRateToUSD", () => {
    describe("when ACT is not supported", () => {
      it("returns CoinGecko market data for akt", async () => {
        const { service } = setup({ isACTSupported: false });

        const result = await service.getExchangeRateToUSD("akt");

        expect(result).toEqual({
          price: 0.56,
          volume: 19000000,
          marketCap: 145000000,
          marketCapRank: 211,
          priceChange24h: 0.05,
          priceChangePercentage24: 10.5
        });
      });

      it("maps akt to akash-network for CoinGecko", async () => {
        const { service, coinGeckoService } = setup({ isACTSupported: false });

        await service.getExchangeRateToUSD("akt");

        expect(coinGeckoService.getMarketData).toHaveBeenCalledWith("akash-network");
      });

      it("maps usdc to usd-coin for CoinGecko", async () => {
        const { service, coinGeckoService } = setup({ isACTSupported: false });

        await service.getExchangeRateToUSD("usdc");

        expect(coinGeckoService.getMarketData).toHaveBeenCalledWith("usd-coin");
      });

      it("passes through unmapped denom to CoinGecko", async () => {
        const { service, coinGeckoService } = setup({ isACTSupported: false });

        await service.getExchangeRateToUSD("akash-network");

        expect(coinGeckoService.getMarketData).toHaveBeenCalledWith("akash-network");
      });
    });

    describe("when ACT is supported", () => {
      it("returns oracle price data", async () => {
        const { service } = setup({ isACTSupported: true });

        const result = await service.getExchangeRateToUSD("akt");

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
        const { service, getPrices } = setup({ isACTSupported: true, currentHeight: 100000n });

        await service.getExchangeRateToUSD("akt");

        const expectedHeight = 100000n - (24n * 60n * 60n) / 6n;
        expect(getPrices).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: expect.objectContaining({ height: expectedHeight })
          })
        );
      });

      it("returns zero price change when historical price is zero", async () => {
        const { service } = setup({ isACTSupported: true, historicalPrice: "0" });

        const result = await service.getExchangeRateToUSD("akt");

        expect(result.priceChange24h).toBe(0.56);
        expect(result.priceChangePercentage24).toBe(0);
      });

      it("returns zero price change when no historical prices available", async () => {
        const { service } = setup({ isACTSupported: true, emptyHistoricalPrices: true });

        const result = await service.getExchangeRateToUSD("akt");

        expect(result.priceChange24h).toBe(0.56);
        expect(result.priceChangePercentage24).toBe(0);
      });
    });
  });

  function setup(input: { isACTSupported: boolean; currentHeight?: bigint; historicalPrice?: string; emptyHistoricalPrices?: boolean }) {
    const blockchainCapabilitiesService = mock<BlockchainCapabilitiesService>();
    blockchainCapabilitiesService.supportsACT.mockResolvedValue(input.isACTSupported);

    const coinGeckoService = mock<CoinGeckoHttpService>();
    coinGeckoService.getMarketData.mockResolvedValue({
      id: "akash-network",
      symbol: "akt",
      name: "Akash Network",
      market_cap_rank: 211,
      market_data: {
        current_price: { usd: 0.56 },
        total_volume: { usd: 19000000 },
        market_cap: { usd: 145000000 },
        price_change_24h: 0.05,
        price_change_percentage_24h: 10.5
      }
    });

    const getLatestBlock = vi.fn().mockResolvedValue({
      block: { header: { height: { toBigInt: () => input.currentHeight ?? 100000n } } }
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

    const service = new DenomExchangeService(chainSdk, coinGeckoService, blockchainCapabilitiesService);

    return { service, coinGeckoService, blockchainCapabilitiesService, getLatestBlock, getAggregatedPrice, getPrices };
  }
});
