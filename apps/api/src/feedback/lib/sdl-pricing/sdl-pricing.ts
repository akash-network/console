import { load } from "js-yaml";
import isEqual from "lodash/isEqual";

interface PricedSdl {
  profiles: { placement: Record<string, { pricing: Record<string, unknown> }> };
  deployment: Record<string, Record<string, { profile: string }>>;
}

interface DeployedPrice {
  profile: string;
  price: unknown;
}

/** Keyed by compute profile rather than placement, so renaming a placement or dropping its attributes keeps the same pricing. */
function deployedPricesOf(sdl: string): DeployedPrice[] {
  try {
    const { profiles, deployment } = load(sdl) as PricedSdl;

    return Object.values(deployment).flatMap(byPlacement =>
      Object.entries(byPlacement).map(([placement, { profile }]) => ({ profile, price: profiles.placement[placement].pricing[profile] }))
    );
  } catch {
    return [];
  }
}

/** Compares only what gets deployed, so a priced placement nothing deploys to cannot mask a new price; an SDL that won't parse never keeps pricing. */
export function keepsPricing(sourceSdl: string, nextSdl: string): boolean {
  const sourcePrices = deployedPricesOf(sourceSdl);
  const nextPrices = deployedPricesOf(nextSdl);

  return (
    nextPrices.length > 0 &&
    nextPrices.every(({ profile, price }) => price !== undefined && sourcePrices.some(source => source.profile === profile && isEqual(source.price, price)))
  );
}
