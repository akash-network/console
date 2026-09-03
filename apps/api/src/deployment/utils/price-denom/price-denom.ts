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
  if (options.grantDenom === AKT_DENOM) return { ok: true };

  const aktPrices = findPrices(placement).filter(price => price.denom === AKT_DENOM);

  if (aktPrices.length === 0) return { ok: true };

  const aktToUsdRate = await options.loadAktToUsdRate();

  if (!Number.isFinite(aktToUsdRate) || aktToUsdRate <= 0) return { ok: false, aktToUsdRate };

  for (const price of aktPrices) {
    price.amount = convertedAmount(price.amount, aktToUsdRate);
    price.denom = options.grantDenom;
  }

  return { ok: true };
}

/** Rounds up so a converted ceiling never lands under the one the user stated. */
function convertedAmount(amount: PriceCoin["amount"], aktToUsdRate: number): PriceCoin["amount"] {
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount)) return amount;

  return Math.ceil(parsedAmount * aktToUsdRate);
}

function findPrices(placement: SdlPlacement | undefined): PriceCoin[] {
  if (!placement || typeof placement !== "object") return [];

  return Object.values(placement).flatMap(profile => {
    if (!profile || typeof profile !== "object" || !profile.pricing || typeof profile.pricing !== "object") return [];

    return Object.values(profile.pricing).filter((price): price is PriceCoin => !!price && typeof price === "object");
  });
}
