import { load } from "js-yaml";
import isEqual from "lodash/isEqual";

type PlacementPricing = Record<string, { pricing?: Record<string, unknown> } | null>;

/** Keyed by compute profile rather than placement, so renaming a placement or dropping its attributes keeps the same pricing. */
function pricingByProfile(sdl: string): Record<string, unknown> | null {
  try {
    const document = load(sdl) as { profiles?: { placement?: PlacementPricing } } | null;
    const placements = Object.values(document?.profiles?.placement ?? {});
    return Object.assign({}, ...placements.map(placement => placement?.pricing ?? {}));
  } catch {
    return null;
  }
}

/** An SDL that won't parse can't be vouched for, so it never keeps pricing. */
export function keepsPricing(sourceSdl: string, nextSdl: string): boolean {
  const sourcePricing = pricingByProfile(sourceSdl);
  return sourcePricing !== null && isEqual(sourcePricing, pricingByProfile(nextSdl));
}
