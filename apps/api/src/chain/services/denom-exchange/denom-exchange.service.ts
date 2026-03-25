import { minutesToMilliseconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class DenomExchangeService {
  readonly #chainSdk: ChainSDK;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK) {
    this.#chainSdk = chainSdk;
  }

  getExchangeRateToUSD = memoizeAsync(
    async (denom: "akt" | "usdc" | "akash-network" | "usd-coin") => {
      const legacyToNewMapping: Record<string, string> = {
        "akash-network": "akt",
        "usd-coin": "usdc"
      };
      const mappedDenom = legacyToNewMapping[denom] ?? denom;

      const latestBlock = await this.#chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock();
      const currentHeight = latestBlock.block?.header?.height?.toBigInt() ?? 0n;
      const blocksPerDay = (24n * 60n * 60n) / BigInt(Math.ceil(averageBlockTime));
      const blockHeight24hAgo = currentHeight > blocksPerDay ? currentHeight - blocksPerDay : 1n;
      const [currentRate, rate24hAgo] = await Promise.all([
        this.#chainSdk.akash.oracle.v1.getAggregatedPrice({ denom: mappedDenom }),
        this.#chainSdk.akash.oracle.v1.getPrices({
          filters: { assetDenom: mappedDenom, baseDenom: "usd", height: blockHeight24hAgo },
          pagination: { limit: 1 }
        })
      ]);
      const price = parseFloat(currentRate.aggregatedPrice?.medianPrice ?? "0");
      const price24hAgo = rate24hAgo.prices[0]?.state?.price ? parseFloat(rate24hAgo.prices[0].state.price) : price;

      return {
        price,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: price - price24hAgo,
        priceChangePercentage24: price24hAgo ? ((price - price24hAgo) / price24hAgo) * 100 : 0
      };
    },
    { cacheItemLimit: 10, ttl: minutesToMilliseconds(10) }
  );
}
