import { hasSeveralRegions } from "@src/utils/sdl/placementRegions";

type BidFrom = { bid: { id: { provider: string } } };

type LocatedProvider = { owner: string; locationRegion: string | null };

/** Only a placement picking several regions has bids Console must sort by region itself, so otherwise no bidder is looked up. */
export function bidderAddressesToLocate(bids: readonly BidFrom[], placements: ReadonlyArray<{ regions?: readonly string[] }>): string[] {
  if (!placements.some(placement => hasSeveralRegions(placement.regions))) return [];
  return [...new Set(bids.map(entry => entry.bid.id.provider))];
}

export function toBidderRegions(providers: readonly LocatedProvider[]): Map<string, string | null> {
  return new Map(providers.map(provider => [provider.owner, provider.locationRegion]));
}
