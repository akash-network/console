import { singleton } from "tsyringe";

import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { averageBlockCountInAMonth } from "@src/utils/constants";
import { round } from "@src/utils/math";

const MICRO_UNITS_PER_UNIT = 1_000_000;

export interface Coin {
  denom: string;
  amount: string | number;
}

/** Converts chain amounts to the US dollars Console shows, so no tool hands the model a denom, a micro amount or a per-block price to repeat. */
@singleton()
export class AssistantUsdService {
  constructor(private readonly denomExchangeService: DenomExchangeService) {}

  /** Null when any coin is in a denom without a known dollar rate, since a partial sum would read as the whole amount. */
  async usdOf(coins: Coin[]): Promise<number | null> {
    return await this.#usdOf(coins, 1);
  }

  async usdPerMonthOf(blockPrices: Coin[]): Promise<number | null> {
    return await this.#usdOf(blockPrices, averageBlockCountInAMonth);
  }

  async #usdOf(coins: Coin[], blocks: number): Promise<number | null> {
    const amounts = await Promise.all(
      coins.map(async ({ denom, amount }) => {
        const usdPerMicroUnit = await this.#usdPerMicroUnitOf(denom);
        return usdPerMicroUnit === null ? null : Number(amount) * blocks * usdPerMicroUnit;
      })
    );

    if (amounts.some(amount => amount === null)) return null;

    return round(
      (amounts as number[]).reduce((total, amount) => total + amount, 0),
      2
    );
  }

  async #usdPerMicroUnitOf(denom: string): Promise<number | null> {
    if (denom === "uact") return 1 / MICRO_UNITS_PER_UNIT;
    if (denom !== "uakt") return null;

    const { price } = await this.denomExchangeService.getExchangeRateToUSD("akt");
    return price > 0 ? price / MICRO_UNITS_PER_UNIT : null;
  }
}
