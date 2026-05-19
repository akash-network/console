import type { SDLInput } from "@akashnetwork/chain-sdk";
import type { Bid } from "@akashnetwork/http-sdk";

export interface RequestedGpu {
  vendor: string;
  model: string;
}

type GpuAttribute = { key: string; value: string };

export function extractRequestedGpusFromSdl(sdl: SDLInput | null | undefined): RequestedGpu[] {
  const computeProfiles = sdl?.profiles?.compute;
  if (!computeProfiles || typeof computeProfiles !== "object") return [];

  const results: RequestedGpu[] = [];

  for (const profile of Object.values(computeProfiles)) {
    const vendorMap = profile?.resources?.gpu?.attributes?.vendor;
    if (!vendorMap || typeof vendorMap !== "object") continue;

    for (const [vendor, models] of Object.entries(vendorMap)) {
      if (!Array.isArray(models)) continue;
      for (const entry of models) {
        if (!entry?.model) continue;
        results.push({ vendor: vendor.toLowerCase(), model: String(entry.model).toLowerCase() });
      }
    }
  }

  return results;
}

export function extractRequestedGpusFromBid(bid: Bid): RequestedGpu[] {
  const results: RequestedGpu[] = [];

  for (const offer of bid.bid.resources_offer ?? []) {
    results.push(...extractGpusFromAttributes(offer.resources?.gpu?.attributes ?? []));
  }

  return results;
}

export function toBlockedGpuSet(blockedKeys: readonly string[]): ReadonlySet<string> {
  return new Set(blockedKeys.map(key => key.toLowerCase()));
}

export function findBlockedGpus(requested: RequestedGpu[], blockedSet: ReadonlySet<string>): RequestedGpu[] {
  if (!blockedSet.size || !requested.length) return [];
  return requested.filter(({ vendor, model }) => blockedSet.has(`${vendor}/${model}`));
}

function extractGpusFromAttributes(attributes: GpuAttribute[]): RequestedGpu[] {
  const results: RequestedGpu[] = [];
  for (const attr of attributes) {
    if (attr.value !== "true") continue;
    const gpu = parseAttributeKey(attr.key);
    if (gpu) results.push(gpu);
  }
  return results;
}

function parseAttributeKey(key: string): RequestedGpu | null {
  const parts = key.split("/");
  let vendor = "";
  let model = "";
  for (let i = 0; i < parts.length - 1; i += 2) {
    if (parts[i] === "vendor") vendor = parts[i + 1];
    else if (parts[i] === "model") model = parts[i + 1];
  }
  if (!vendor || !model) return null;
  return { vendor: vendor.toLowerCase(), model: model.toLowerCase() };
}
