import { load } from "js-yaml";
import isEqual from "lodash/isEqual";

interface PricedSdl {
  profiles?: { placement?: Record<string, { pricing?: Record<string, unknown> } | null> };
  deployment?: Record<string, Record<string, { profile?: string } | null> | null>;
}

interface DeployedPrice {
  profile: string | undefined;
  price: unknown;
}

/** Keyed by compute profile rather than placement, so renaming a placement or dropping its attributes keeps the same pricing. */
function deployedPricesOf(sdl: string): DeployedPrice[] | null {
  try {
    const document = load(sdl) as PricedSdl | null;
    const placements = document?.profiles?.placement ?? {};

    return Object.values(document?.deployment ?? {}).flatMap(byPlacement =>
      Object.entries(byPlacement ?? {}).map(([placement, entry]) => ({
        profile: entry?.profile,
        price: entry?.profile === undefined ? undefined : placements[placement]?.pricing?.[entry.profile]
      }))
    );
  } catch {
    return null;
  }
}

/** Compares only what gets deployed, so a priced placement nothing deploys to cannot mask a new price; an SDL that won't parse never keeps pricing. */
export function keepsPricing(sourceSdl: string, nextSdl: string): boolean {
  const sourcePrices = deployedPricesOf(sourceSdl);
  const nextPrices = deployedPricesOf(nextSdl);
  if (!sourcePrices || !nextPrices?.length) return false;

  return nextPrices.every(
    ({ profile, price }) => price !== undefined && sourcePrices.some(source => source.profile === profile && isEqual(source.price, price))
  );
}
