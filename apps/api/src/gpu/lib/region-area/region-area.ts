import type { REGION_AREAS } from "@src/hardware-request/model-schemas/hardware-request/hardware-request.schema";

export type RegionArea = (typeof REGION_AREAS)[number];

const AREA_BY_REGION_PREFIX: [prefix: string, area: RegionArea][] = [
  ["na-us-", "us"],
  ["na-ca-", "ca"],
  ["eu-", "eu"],
  ["as-west", "me"],
  ["as-", "apac"],
  ["oc-", "apac"],
  ["sa-", "latam"],
  ["central-america", "latam"],
  ["caribbean", "latam"]
];

/** Maps a provider's `location-region` attribute onto a request area; the schema has no UK or Africa split, so GB counts as eu and Africa as none. */
export function toRegionArea(locationRegion: string | null | undefined): RegionArea | null {
  if (!locationRegion) return null;

  const region = locationRegion.toLowerCase();
  return AREA_BY_REGION_PREFIX.find(([prefix]) => region.startsWith(prefix))?.[1] ?? null;
}
