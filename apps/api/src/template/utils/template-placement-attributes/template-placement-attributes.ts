import { yaml } from "@akashnetwork/chain-sdk";
import { dump } from "js-yaml";

/** Console's deploy UI can neither show nor edit placement attributes, and an attribute the required auditor never signed leaves a deployment with no bids. */
export function withoutPlacementAttributes(sdl: string): string {
  const { document, placementProfiles } = readPlacementProfiles(sdl);
  const profilesWithAttributes = placementProfiles.filter(profile => "attributes" in profile);

  if (profilesWithAttributes.length === 0) {
    return sdl;
  }

  profilesWithAttributes.forEach(profile => delete profile.attributes);

  return dump(document, { lineWidth: -1 });
}

function readPlacementProfiles(sdl: string) {
  try {
    const document = yaml.raw<unknown>(sdl);
    const placement = isRecord(document) && isRecord(document.profiles) ? document.profiles.placement : undefined;
    const placementProfiles = isRecord(placement) ? Object.values(placement).filter(isRecord) : [];

    return { document, placementProfiles };
  } catch {
    return { document: undefined, placementProfiles: [] };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
