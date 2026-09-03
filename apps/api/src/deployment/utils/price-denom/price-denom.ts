import type { SDLInput } from "@akashnetwork/chain-sdk";

type SdlPlacement = SDLInput["profiles"]["placement"];
type PriceCoin = SdlPlacement[string]["pricing"][string];

export type GrantDenom = PriceCoin["denom"];
export type PriceRestatement = { ok: true } | { ok: false; aktToUsdRate: number };

const AKT_DENOM = "uakt";

/** Managed deployments pay out of a grant in a single denom, so a uakt ceiling is restated in it through the AKT price rather than swapped over. */
export async function restatePricesInGrantDenom(
  placement: SdlPlacement | undefined,
  options: { grantDenom: GrantDenom; loadAktToUsdRate: () => Promise<number> }
): Promise<PriceRestatement> {
  const prices = findPrices(placement).filter(price => price.denom !== options.grantDenom);

  if (prices.length === 0) return { ok: true };

  if (!prices.some(isAktPriced)) {
    restate(prices, { grantDenom: options.grantDenom });
    return { ok: true };
  }

  const aktToUsdRate = await options.loadAktToUsdRate();

  if (!Number.isFinite(aktToUsdRate) || aktToUsdRate <= 0) return { ok: false, aktToUsdRate };

  restate(prices, { grantDenom: options.grantDenom, aktToUsdRate });

  return { ok: true };
}

function restate(prices: PriceCoin[], options: { grantDenom: GrantDenom; aktToUsdRate?: number }): void {
  for (const price of prices) {
    if (options.aktToUsdRate !== undefined) price.amount = convertedAmount(price, options.aktToUsdRate);
    price.denom = options.grantDenom;
  }
}

function isAktPriced(price: PriceCoin): boolean {
  return price.denom === AKT_DENOM;
}

/** Rounds up so a converted ceiling never lands under the one the user stated. */
function convertedAmount(price: PriceCoin, aktToUsdRate: number): PriceCoin["amount"] {
  const amount = Number(price.amount);

  if (!isAktPriced(price) || !Number.isFinite(amount)) return price.amount;

  return Math.ceil(amount * aktToUsdRate);
}

function findPrices(placement: SdlPlacement | undefined): PriceCoin[] {
  if (!placement || typeof placement !== "object") return [];

  return Object.values(placement).flatMap(profile => {
    if (!profile || typeof profile !== "object" || !profile.pricing || typeof profile.pricing !== "object") return [];

    return Object.values(profile.pricing).filter((price): price is PriceCoin => !!price && typeof price === "object");
  });
}
