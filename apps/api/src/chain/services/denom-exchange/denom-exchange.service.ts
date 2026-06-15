import { minutesToMilliseconds, subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { LoggerService } from "@src/core/providers/logging.provider";
import { DayRepository } from "@src/gpu/repositories/day.repository";

@singleton()
export class DenomExchangeService {
  readonly #chainSdk: ChainSDK;
  readonly #dayRepository: DayRepository;
  readonly #logger: LoggerService;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK, dayRepository: DayRepository, logger: LoggerService) {
    this.#chainSdk = chainSdk;
    this.#dayRepository = dayRepository;
    this.#logger = logger;
  }

  getExchangeRateToUSD = memoizeAsync(
    async (denom: "akt" | "akash-network") => {
      const legacyToNewMapping: Record<string, string> = {
        "akash-network": "akt"
      };
      const mappedDenom = legacyToNewMapping[denom] ?? denom;

      try {
        const { oracleRate, rate24hAgo } = await this.#fetchOracleRate(mappedDenom);

        if (!oracleRate.priceHealth?.isHealthy) {
          this.#logger.warn({ event: "ORACLE_PRICE_UNHEALTHY", denom: mappedDenom });
          return await this.#getFallbackExchangeRateToUSD();
        }

        const price = parseFloat(oracleRate.aggregatedPrice?.medianPrice ?? "0");
        const price24hAgo = rate24hAgo.prices[0]?.state?.price ? parseFloat(rate24hAgo.prices[0].state.price) : price;

        return {
          price,
          volume: 0,
          marketCap: 0,
          marketCapRank: 0,
          priceChange24h: price - price24hAgo,
          priceChangePercentage24: price24hAgo ? ((price - price24hAgo) / price24hAgo) * 100 : 0
        };
      } catch (error) {
        this.#logger.warn({ event: "ORACLE_RPC_FAILED", denom: mappedDenom, error });
        return await this.#getFallbackExchangeRateToUSD();
      }
    },
    { cacheItemLimit: 10, ttl: minutesToMilliseconds(10) }
  );

  // Queries Oracle V2 only. A failed aggregated-price query propagates to the caller's
  // CoinGecko/DB fallback; a failed 24h-history query is swallowed (see below).
  async #fetchOracleRate(mappedDenom: string) {
    const endTime = new Date();
    // 23h, not 24h: V2 prunes to ~24h, so the exact-24h price may already be gone.
    const startTime = subHours(endTime, 23);
    const [oracleRate, rate24hAgo] = await Promise.all([
      this.#chainSdk.akash.oracle.v2.getAggregatedPrice({ denom: mappedDenom }),
      this.#chainSdk.akash.oracle.v2
        .getPrices({
          filters: { assetDenom: mappedDenom, baseDenom: "usd", startTime, endTime },
          pagination: { limit: 1 }
        })
        // history feeds only the unused priceChange fields — never fail the price over it
        .catch((error): { prices: [] } => {
          this.#logger.warn({ event: "ORACLE_V2_PRICE_HISTORY_UNAVAILABLE", denom: mappedDenom, error });
          return { prices: [] };
        })
    ]);
    return { oracleRate, rate24hAgo };
  }

  async #getFallbackExchangeRateToUSD() {
    const aktPrice = await this.#dayRepository.getLatestAktPrice();

    return {
      price: aktPrice ?? 0,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    };
  }
}
