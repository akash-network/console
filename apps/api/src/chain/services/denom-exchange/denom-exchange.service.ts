import { minutesToMilliseconds, subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { LoggerService } from "@src/core/providers/logging.provider";
import { DayRepository } from "@src/gpu/repositories/day.repository";
import { averageBlockTime } from "@src/utils/constants";

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

  /**
   * Version-aware oracle fetch: prefer Oracle V2, falling back to V1 when the V2 query service is
   * unavailable (e.g. on nodes that have not yet run the v2.1.0 upgrade, which do not register the
   * V2 query service so the call throws). The V1 fallback is removed once V2 is stable on mainnet.
   */
  async #fetchOracleRate(mappedDenom: string) {
    try {
      return await this.#fetchOracleRateV2(mappedDenom);
    } catch (error) {
      this.#logger.warn({ event: "ORACLE_V2_UNAVAILABLE_FALLBACK_V1", denom: mappedDenom, error });
      return await this.#fetchOracleRateV1(mappedDenom);
    }
  }

  async #fetchOracleRateV2(mappedDenom: string) {
    const endTime = new Date();
    // V2 prunes oracle state to ~24h; query just inside that window (23h) since a price exactly 24h
    // back may already be pruned. This figure feeds only the (currently unused) priceChange fields,
    // so a failure here must not degrade the billing-critical current price — degrade to empty.
    const startTime = subHours(endTime, 23);
    const [oracleRate, rate24hAgo] = await Promise.all([
      this.#chainSdk.akash.oracle.v2.getAggregatedPrice({ denom: mappedDenom }),
      this.#chainSdk.akash.oracle.v2
        .getPrices({
          filters: { assetDenom: mappedDenom, baseDenom: "usd", startTime, endTime },
          pagination: { limit: 1 }
        })
        .catch((error): { prices: [] } => {
          this.#logger.warn({ event: "ORACLE_V2_PRICE_HISTORY_UNAVAILABLE", denom: mappedDenom, error });
          return { prices: [] };
        })
    ]);
    return { oracleRate, rate24hAgo };
  }

  async #fetchOracleRateV1(mappedDenom: string) {
    const latestBlock = await this.#chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock();
    const currentHeight = latestBlock.block?.header?.height?.toBigInt() ?? 0n;
    const blocksPerDay = (24n * 60n * 60n) / BigInt(Math.ceil(averageBlockTime));
    const blockHeight24hAgo = currentHeight > blocksPerDay ? currentHeight - blocksPerDay : 1n;
    const [oracleRate, rate24hAgo] = await Promise.all([
      this.#chainSdk.akash.oracle.v1.getAggregatedPrice({ denom: mappedDenom }),
      this.#chainSdk.akash.oracle.v1.getPrices({
        filters: { assetDenom: mappedDenom, baseDenom: "usd", height: blockHeight24hAgo },
        pagination: { limit: 1 }
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
