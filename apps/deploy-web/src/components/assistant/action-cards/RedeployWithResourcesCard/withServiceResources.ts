import yaml from "js-yaml";
import isEqual from "lodash/isEqual";

import type { ServiceResources } from "../serviceResourcesFormat/serviceResourcesFormat";

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

export class SharedComputeProfileError extends Error {}

/** Rewrites only compute sizes and replica counts, leaving placement pricing untouched; a profile two services share is refused rather than resized for both. */
export function withServiceResources(sdl: string, changes: ServiceResourcesChange[]): string {
  const document = yaml.load(sdl) as SdlDocument;
  const placements = document.deployment ?? {};

  changes.forEach(({ service, before, after }) => {
    const placement = Object.values(placements[service] ?? {})[0];
    const profileName = placement?.profile;
    const resources = profileName ? document.profiles?.compute?.[profileName]?.resources : undefined;
    if (!placement || !profileName || !resources) throw new Error(`The SDL has no compute profile for service ${service}.`);
    if (isSharedProfile(placements, service, profileName)) {
      throw new SharedComputeProfileError(`Service ${service} shares its compute profile with another service. Change its resources in the editor.`);
    }

    applyResources(resources, before, after);
    if (after.count !== null && after.count !== before.count) placement.count = after.count;
  });

  return yaml.dump(document, { lineWidth: -1 });
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

/** Keeps each listed model's other attributes, such as ram or interface, when the model list stays the same model. */
function gpuAttributesOf(models: string[], current: unknown): Mapping {
  const currentVendors = ((current as Mapping | undefined)?.vendor ?? {}) as Record<string, Mapping[] | null>;
  if (models.length === 0) return { vendor: Object.keys(currentVendors).length > 0 ? mapValues(currentVendors, () => null) : { nvidia: null } };

  const vendor: Record<string, Mapping[]> = {};
  models.forEach(entry => {
    const [vendorName, model] = entry.includes("/") ? entry.split("/", 2) : ["nvidia", entry];
    const existing = (currentVendors[vendorName] ?? []).find(candidate => candidate.model === model);
    vendor[vendorName] = [...(vendor[vendorName] ?? []), existing ?? { model }];
  });
  return { ...(current as Mapping | undefined), vendor };
}

function mapValues<T, R>(record: Record<string, T>, map: (value: T) => R): Record<string, R> {
  return Object.fromEntries(Object.keys(record).map(key => [key, map(record[key])]));
}
