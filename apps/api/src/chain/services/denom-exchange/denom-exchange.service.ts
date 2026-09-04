import { minutesToMilliseconds, subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { DayRepository } from "@src/gpu/repositories/day.repository";

const UNAVAILABLE_PRICE = 0;

/** memoizeAsync drops only a rejected promise, so an unusable rate rejects to stay out of the 10 minute cache and be retried on the next call. */
class UnavailableExchangeRateError extends Error {}

@singleton()
export class DenomExchangeService {
  readonly #chainSdk: ChainSDK;
  readonly #dayRepository: DayRepository;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK, dayRepository: DayRepository, @inject(LOGGER_FACTORY) createLogger: CreateLogger) {
    this.#logger = createLogger({ context: DenomExchangeService.name });
    this.#chainSdk = chainSdk;
    this.#dayRepository = dayRepository;
  }

  async getExchangeRateToUSD(denom: "akt" | "akash-network") {
    try {
      return await this.#cachedExchangeRateToUSD(denom);
    } catch (error) {
      if (error instanceof UnavailableExchangeRateError) return this.#rateOf(UNAVAILABLE_PRICE);

      throw error;
    }
  }

  #cachedExchangeRateToUSD = memoizeAsync(
    async (denom: "akt" | "akash-network") => {
      const rate = await this.#loadExchangeRateToUSD(denom);

      if (!Number.isFinite(rate.price) || rate.price <= UNAVAILABLE_PRICE) {
        this.#logger.warn({ event: "EXCHANGE_RATE_UNAVAILABLE", denom });
        throw new UnavailableExchangeRateError();
      }

      return rate;
    },
    { cacheItemLimit: 10, ttl: minutesToMilliseconds(10), name: "DenomExchangeService#getExchangeRateToUSD" }
  );

  async #loadExchangeRateToUSD(denom: "akt" | "akash-network") {
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
  }

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

    return this.#rateOf(aktPrice ?? UNAVAILABLE_PRICE);
  }

  #rateOf(price: number) {
    return {
      price,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    };
  }
}
