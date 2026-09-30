/** Akash matches a placement attribute on one exact value, so only a single picked region can travel in the SDL. */
export function sdlRegionOf(regions: readonly string[] | undefined): string | undefined {
  return regions?.length === 1 ? regions[0] : undefined;
}

/** Several picked regions never reach the chain, so Console keeps a placement to providers in them itself. */
export function hasSeveralRegions(regions: readonly string[] | undefined): regions is readonly string[] {
  return !!regions && regions.length > 1;
}

/** No pick or a single one (enforced by the SDL) accepts every provider; several accept only a provider known to be in one of them. */
export function isInPickedRegions(regions: readonly string[] | undefined, providerRegion: string | null | undefined): boolean {
  if (!hasSeveralRegions(regions)) return true;
  if (!providerRegion) return false;

  const normalizedProviderRegion = providerRegion.toLowerCase();
  return regions.some(region => region.toLowerCase() === normalizedProviderRegion);
}

/** Only placements picking several regions need their picks kept beside the SDL, which already carries a single one. */
export function severalRegionPicksOf(placements: ReadonlyArray<{ name: string; regions?: readonly string[] }>): Record<string, string[]> {
  return Object.fromEntries(placements.flatMap(placement => (hasSeveralRegions(placement.regions) ? [[placement.name, [...placement.regions]]] : [])));
}
