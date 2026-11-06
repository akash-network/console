import { dump, load } from "js-yaml";
import isEqual from "lodash/isEqual";

import type { ServiceResources } from "@src/feedback/http-schemas/assistant-action.schema";

export interface ServiceResourcesChange {
  service: string;
  before: ServiceResources;
  after: ServiceResources;
}

type Mapping = Record<string, unknown>;

interface SdlDocument {
  profiles?: { compute?: Record<string, { resources?: Mapping }> };
  deployment?: Record<string, Record<string, { profile?: string; count?: number }>>;
}

/** Rewrites compute sizes and replica counts the way the redeploy card does, or answers null for an SDL the card would send to the editor instead. */
export function sdlWithResources(sdl: string, changes: ServiceResourcesChange[]): string | null {
  const document = load(sdl) as SdlDocument;
  const placements = document.deployment ?? {};

  for (const { service, before, after } of changes) {
    const placement = Object.values(placements[service] ?? {})[0];
    const profileName = placement?.profile;
    const resources = profileName ? document.profiles?.compute?.[profileName]?.resources : undefined;
    if (!placement || !profileName || !resources || isSharedProfile(placements, service, profileName)) return null;

    applyResources(resources, before, after);
    if (after.count !== null && after.count !== before.count) placement.count = after.count;
  }

  return dump(document, { lineWidth: -1 });
}

function isSharedProfile(placements: NonNullable<SdlDocument["deployment"]>, service: string, profileName: string): boolean {
  return Object.entries(placements).some(
    ([other, byPlacement]) => other !== service && Object.values(byPlacement).some(({ profile }) => profile === profileName)
  );
}

function applyResources(resources: Mapping, before: ServiceResources, after: ServiceResources) {
  if (after.cpu !== null && after.cpu !== before.cpu) resources.cpu = { ...(resources.cpu as Mapping), units: after.cpu };
  if (after.memory !== null && after.memory !== before.memory) resources.memory = { ...(resources.memory as Mapping), size: after.memory };
  if (!isEqual(after.storage, before.storage)) resources.storage = storageWithSizes(resources.storage, after.storage);
  if (isEqual(after.gpu, before.gpu)) return;

  if (after.gpu) {
    const currentGpu = resources.gpu as Mapping | undefined;
    resources.gpu = { ...currentGpu, units: after.gpu.units, attributes: gpuAttributesOf(after.gpu.models, currentGpu?.attributes) };
  } else {
    delete resources.gpu;
  }
}

function storageWithSizes(storage: unknown, sizes: string[]): unknown {
  if (Array.isArray(storage)) return storage.map((volume: Mapping, index) => (sizes[index] === undefined ? volume : { ...volume, size: sizes[index] }));
  if (storage && typeof storage === "object" && sizes[0] !== undefined) return { ...(storage as Mapping), size: sizes[0] };
  return storage;
}

function gpuAttributesOf(models: string[], current: unknown): Mapping {
  const currentVendors = ((current as Mapping | undefined)?.vendor ?? {}) as Record<string, Mapping[] | null>;
  if (models.length === 0) {
    const anyModelOf = Object.keys(currentVendors).length > 0 ? Object.keys(currentVendors) : ["nvidia"];
    return { vendor: Object.fromEntries(anyModelOf.map(vendorName => [vendorName, null])) };
  }

  const vendor: Record<string, Mapping[]> = {};
  for (const entry of models) {
    const [vendorName, model] = entry.includes("/") ? entry.split("/", 2) : ["nvidia", entry];
    const existing = (currentVendors[vendorName] ?? []).find(candidate => candidate.model === model);
    vendor[vendorName] = [...(vendor[vendorName] ?? []), existing ?? { model }];
  }

  return { ...(current as Mapping | undefined), vendor };
}
