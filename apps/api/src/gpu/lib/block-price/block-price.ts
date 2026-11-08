import { averageBlockCountInAMonth, averageBlockCountInAnHour } from "@src/utils/constants";
import { round } from "@src/utils/math";

export type BlockPricePeriod = "hour" | "month";

const BLOCKS_PER_PERIOD: Record<BlockPricePeriod, number> = {
  hour: averageBlockCountInAnHour,
  month: averageBlockCountInAMonth
};

export interface BlockPrice {
  denom: string | undefined;
  amountPerBlock: number;
}

/** Only uact (1:1 with USD) and uakt (at the given AKT price) convert; anything else, or uakt without a price, is null. */
export function blockPriceToUsd({ denom, amountPerBlock }: BlockPrice, aktPrice: number | null | undefined, period: BlockPricePeriod): number | null {
  if (denom === "uact") return round((BLOCKS_PER_PERIOD[period] * amountPerBlock) / 1_000_000, 2);
  if (denom === "uakt" && aktPrice) return round((BLOCKS_PER_PERIOD[period] * amountPerBlock * aktPrice) / 1_000_000, 2);
  return null;
}

/** uact converts to uakt at the given AKT price; anything else, or uact without a price, is null. */
export function blockPriceToUakt({ denom, amountPerBlock }: BlockPrice, aktPrice: number | null | undefined, period: BlockPricePeriod): number | null {
  if (denom === "uakt") return round(BLOCKS_PER_PERIOD[period] * amountPerBlock, 2);
  if (denom === "uact" && aktPrice) return round(BLOCKS_PER_PERIOD[period] * (amountPerBlock / aktPrice), 2);
  return null;
}
