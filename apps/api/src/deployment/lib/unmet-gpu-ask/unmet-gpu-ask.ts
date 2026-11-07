import uniqBy from "lodash/uniqBy";
import { createHash } from "node:crypto";

import type { UnmetDemandKind } from "@src/deployment/model-schemas";
import { type RegionArea, toRegionArea } from "@src/gpu/lib/region-area/region-area";

interface Attribute {
  key: string;
  value: string;
}

/** The shape a bid screening request and a chain group spec share, so both are read the same way. */
export interface GpuAskSource {
  requirements?: { attributes?: Attribute[] };
  resources: Array<{
    resource?: { gpu?: { units?: { val: bigint }; attributes?: Attribute[] } };
    count: number;
  }>;
}

export interface AskedGpuModel {
  vendor: string | null;
  model: string | null;
}

export interface GpuAsk extends AskedGpuModel {
  gpuCount: number;
  regionArea: RegionArea | null;
}

export interface OfferedGpuModel {
  vendor: string;
  model: string;
}

const LOCATION_REGION_ATTRIBUTE = "location-region";

const GPU_ATTRIBUTE_KEY = /^vendor\/([^/]+)(?:\/model\/([^/]+))?/;

const ANY_GPU: AskedGpuModel = { vendor: null, model: null };

/** Asks above this are not real demand, and they would overflow the stored int4 count. */
export const MAX_ASKED_GPUS = 10_000;

const MAX_VENDOR_LENGTH = 64;
const MAX_MODEL_LENGTH = 255;

/** A unit naming several models accepts any of them, so its gpus count toward each model it names. */
export function findGpuAsks(source: GpuAskSource): GpuAsk[] {
  const regionArea = findRegionArea(source);
  const asksByModel = new Map<string, GpuAsk>();

  for (const unit of source.resources) {
    const gpuCount = toGpuCount(unit);
    if (!Number.isSafeInteger(gpuCount) || gpuCount <= 0) continue;

    for (const { vendor, model } of findAskedModels(unit.resource?.gpu?.attributes ?? []).filter(fitsStoredColumns)) {
      const key = `${vendor ?? "*"}/${model ?? "*"}`;
      const ask = asksByModel.get(key) ?? { vendor, model, gpuCount: 0, regionArea };
      ask.gpuCount += gpuCount;
      asksByModel.set(key, ask);
    }
  }

  return [...asksByModel.values()].filter(isStorableAsk);
}

export function isStorableAsk(ask: GpuAsk): boolean {
  return Number.isSafeInteger(ask.gpuCount) && ask.gpuCount > 0 && ask.gpuCount <= MAX_ASKED_GPUS && fitsStoredColumns(ask);
}

export function countGpus({ resources }: GpuAskSource): number {
  return resources.reduce((total, unit) => total + toGpuCount(unit), 0);
}

export function findRegionArea(source: GpuAskSource): RegionArea | null {
  return toRegionArea(source.requirements?.attributes?.find(({ key }) => key === LOCATION_REGION_ATTRIBUTE)?.value);
}

/** Hashes the asker with the UTC day, so one person repeating an ask counts once a day and their keys cannot be linked across days. */
export function toAskToken(ask: GpuAsk, occurredAt: Date, actorId: string): string {
  return sha256([ask.vendor ?? "*", ask.model ?? "*", ask.gpuCount, ask.regionArea ?? "*", occurredAt.toISOString().slice(0, 10), actorId].join("|"));
}

export function toDedupeKey(kind: UnmetDemandKind, askToken: string): string {
  return sha256(`${kind}|${askToken}`);
}

/** A model no online provider has at all is missing from the network, while one some provider has just did not fit the rest of the ask. */
export function classifyEmptyScreening(ask: AskedGpuModel, offeredModels: OfferedGpuModel[]): Extract<UnmetDemandKind, "no_fit" | "missing_gpu"> {
  const isOffered = offeredModels.some(offered => (!ask.vendor || offered.vendor === ask.vendor) && (!ask.model || offered.model === ask.model));
  return isOffered ? "no_fit" : "missing_gpu";
}

function toGpuCount({ resource, count }: GpuAskSource["resources"][number]): number {
  return Number(resource?.gpu?.units?.val ?? 0n) * count;
}

function findAskedModels(attributes: Attribute[]): AskedGpuModel[] {
  const models = attributes.filter(({ value }) => value === "true").map(({ key }) => toAskedModel(key));
  return models.length ? uniqBy(models, ({ vendor, model }) => `${vendor ?? "*"}/${model ?? "*"}`) : [ANY_GPU];
}

function toAskedModel(key: string): AskedGpuModel {
  const match = GPU_ATTRIBUTE_KEY.exec(key);
  if (!match) return ANY_GPU;

  return { vendor: withoutWildcard(match[1]), model: withoutWildcard(match[2]) };
}

function withoutWildcard(name: string | undefined): string | null {
  return name && !name.includes("*") ? name.toLowerCase() : null;
}

function fitsStoredColumns({ vendor, model }: AskedGpuModel): boolean {
  return (vendor?.length ?? 0) <= MAX_VENDOR_LENGTH && (model?.length ?? 0) <= MAX_MODEL_LENGTH;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
