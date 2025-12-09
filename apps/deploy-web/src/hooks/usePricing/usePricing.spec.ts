import { SANDBOX_ID } from "@akashnetwork/chain-sdk/web";
import type { HttpClient } from "@akashnetwork/http-sdk";
import type { NetworkStore } from "@akashnetwork/network-store";
import { mock } from "jest-mock-extended";

import { UAKT_DENOM } from "@src/config/denom.config";
import type { MarketData } from "@src/types/dashboard";
import { getUsdcDenom } from "@src/utils/priceUtils";
import { usePricing } from "./usePricing";

import { waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(usePricing.name, () => {
  it("calculates conversions when market data is available", async () => {
    const price = 1.52;
    const { result } = setup({
      marketData: buildMarketData({ price })
    });

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.price).toBe(price);
    expect(result.current.uaktToUSD(1_000_000)).toBe(price);
    expect(result.current.aktToUSD(2)).toBe(3.04);
    expect(result.current.usdToAkt(3.04)).toBe(2);
    expect(result.current.getPriceForDenom(UAKT_DENOM)).toBe(price);
    expect(result.current.getPriceForDenom("other-denom")).toBe(0);
    expect(result.current.udenomToUsd(1_000_000, UAKT_DENOM)).toBe(price);
    expect(result.current.udenomToUsd(500_000, "usdc")).toBe(0.5);
    expect(result.current.udenomToUsd(500_000, getUsdcDenom(SANDBOX_ID))).toBe(0.5);
    expect(result.current.udenomToUsd(500_000, "unknown")).toBe(0);
  });

  it("returns fallback values when market data is unavailable", () => {
    const { result } = setup({
      marketData: null,
      isLoadingMarketData: true
    });

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.price).toBeUndefined();
    expect(result.current.uaktToUSD(1_000_000)).toBeNull();
    expect(result.current.aktToUSD(1)).toBeNull();
    expect(result.current.usdToAkt(1)).toBeNull();
    expect(result.current.getPriceForDenom(UAKT_DENOM)).toBe(0);
    expect(result.current.udenomToUsd(1_000_000, UAKT_DENOM)).toBe(0);
    expect(result.current.udenomToUsd(1_000_000, "usdc")).toBe(1);
    expect(result.current.udenomToUsd(1_000_000, getUsdcDenom(SANDBOX_ID))).toBe(1);
  });

  function setup(input?: { marketData?: MarketData | null; isLoadingMarketData?: boolean }) {
    const result = setupQuery(() => usePricing(), {
      services: {
        publicConsoleApiHttpClient: () =>
          mock<HttpClient>({
            get: async () => {
              if (input?.isLoadingMarketData) return new Promise(() => {});
              return {
                data: input?.marketData === undefined ? buildMarketData() : input.marketData
              };
            }
          } as unknown as HttpClient),
        networkStore: () =>
          mock<NetworkStore>({
            useSelectedNetworkId: () => SANDBOX_ID
          })
      }
    });

    return result;
  }

  function buildMarketData(overrides?: Partial<MarketData>): MarketData {
    return {
      price: 1.25,
      volume: 1_000_000,
      marketCap: 500_000_000,
      marketCapRank: 100,
      priceChange24h: 0.01,
      priceChangePercentage24: 0.5,
      ...overrides
    };
  }
});
