import { minutesToMilliseconds, subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { LoggerService } from "@src/core/providers/logging.provider";
import { DayRepository } from "@src/gpu/repositories/day.repository";
import { averageBlockTime } from "@src/utils/constants";

// gRPC "Unimplemented" code, returned for an unregistered query method (chain-sdk's TransportErrorCode isn't exported).
const TRANSPORT_CODE_UNIMPLEMENTED = 12;

function isOracleQueryUnimplemented(error: unknown): boolean {
  return error instanceof Error && error.name === "TransportError" && (error as { code?: unknown }).code === TRANSPORT_CODE_UNIMPLEMENTED;
}

@singleton()
export class DenomExchangeService {
  readonly #chainSdk: ChainSDK;
  readonly #dayRepository: DayRepository;
  readonly #logger: LoggerService;
  // Goes false once V2 returns Unimplemented; we then skip V2 until the V1 fallback breaks.
  #isOracleV2Available = true;

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

  // Prefer V2; fall back to V1 only when V2 is unimplemented (pre-v2.1.0), caching that until V1
  // breaks. Other V2 errors propagate to the caller's CoinGecko fallback.
  async #fetchOracleRate(mappedDenom: string) {
    if (this.#isOracleV2Available) {
      try {
        return await this.#fetchOracleRateV2(mappedDenom);
      } catch (error) {
        if (!isOracleQueryUnimplemented(error)) throw error;
        this.#isOracleV2Available = false;
        this.#logger.warn({ event: "ORACLE_V2_UNAVAILABLE_FALLBACK_V1", denom: mappedDenom });
      }
    }

    try {
      return await this.#fetchOracleRateV1(mappedDenom);
    } catch (error) {
      this.#isOracleV2Available = true;
      throw error;
    }
  }

  async #fetchOracleRateV2(mappedDenom: string) {
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
