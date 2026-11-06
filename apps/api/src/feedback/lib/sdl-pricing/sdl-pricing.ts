import { dump, load } from "js-yaml";
import isEqual from "lodash/isEqual";

/** Must stay equal to deploy-web's `defaultPricing()`, the ceiling the editor starts every new service with. */
export const DEFAULT_MAX_PRICE = { denom: "uact", amount: 100_000 } as const;

type Mapping = Record<string, unknown>;

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

/** Prices every profile of every placement at Console's default ceiling; an SDL that won't parse comes back as is, for validation to refuse. */
export function withDefaultPricing(sdl: string): string {
  const document = parsedMapping(sdl);
  const profiles = document?.profiles;
  const placements = isMapping(profiles) ? profiles.placement : undefined;
  if (!document || !isMapping(placements)) return sdl;

  for (const [name, placement] of Object.entries(placements)) {
    if (!isMapping(placement)) continue;

    const pricedProfiles = isMapping(placement.pricing) ? Object.keys(placement.pricing) : [];
    const pricedOrDeployedProfiles = new Set([...pricedProfiles, ...profilesDeployedTo(document.deployment, name)]);
    placement.pricing = Object.fromEntries([...pricedOrDeployedProfiles].map(profile => [profile, { ...DEFAULT_MAX_PRICE }]));
  }

  return dump(document, { lineWidth: -1 });
}

function parsedMapping(sdl: string): Mapping | null {
  try {
    const document = load(sdl);
    return isMapping(document) ? document : null;
  } catch {
    return null;
  }
}

function profilesDeployedTo(deployment: unknown, placement: string): string[] {
  if (!isMapping(deployment)) return [];

  return Object.values(deployment).flatMap(byPlacement => {
    const profile = isMapping(byPlacement) && isMapping(byPlacement[placement]) ? byPlacement[placement].profile : undefined;
    return typeof profile === "string" ? [profile] : [];
  });
}

function isMapping(value: unknown): value is Mapping {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
