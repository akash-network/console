import { minutesToMilliseconds } from "date-fns";
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
