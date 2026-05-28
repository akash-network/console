import type { ParsedGPUAttributes } from "../lib/gpu-attribute-parser/gpu-attribute-parser";
import type { ResourcePair } from "../lib/resource-pair/resource-pair";
import type { ParsedStorageAttributes } from "../lib/storage-attribute-parser/storage-attribute-parser";

export interface GpuInfo {
  vendor: string;
  name: string;
  modelId: string;
  interface: string;
  memorySize: string;
}

export interface CpuInfo {
  vendor: string;
  model: string;
}

export interface NodeState {
  name: string;
  cpu: ResourcePair;
  memory: ResourcePair;
  ephemeralStorage: ResourcePair;
  gpu: { quantity: ResourcePair; info: GpuInfo[] };
  storageClasses: string[];
  cpus: CpuInfo[];
}

export interface ClusterState {
  nodes: NodeState[];
  storage: Record<string, { class: string; quantity: ResourcePair }>;
}

export interface RequestedStorage {
  name: string;
  quantity: bigint;
  attributes: ParsedStorageAttributes;
}

export interface ResourceAttribute {
  key: string;
  value: string;
}

export interface RequestedResources {
  cpu: { units: bigint; fingerprint: string | null };
  gpu: { units: bigint; attributes: ParsedGPUAttributes[] };
  memory: { quantity: bigint };
  storage: RequestedStorage[];
}

export interface RequestedResourceUnit {
  id: number;
  resources: RequestedResources;
  count: number;
}

export interface MatchResult {
  matched: boolean;
  error?: "INSUFFICIENT_CAPACITY" | "GROUP_RESOURCE_MISMATCH";
}

export interface BidScreeningResult {
  owner: string;
  hostUri: string;
  isAudited: boolean;
}

export type ToJSON<T> = T extends Uint8Array ? bigint : T extends object ? { -readonly [K in keyof T]: ToJSON<Exclude<T[K], undefined>> } : T;
