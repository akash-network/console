import type { ParsedGPUAttributes } from "../mappers/gpu-attribute-parser/gpu-attribute-parser";
import type { ParsedStorageAttributes } from "../mappers/storage-attribute-parser/storage-attribute-parser";

export type RawPair = { allocatable: number | bigint; allocated: number | bigint };

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
  cpu: RawPair;
  memory: RawPair;
  ephemeralStorage: RawPair;
  gpu: { quantity: RawPair; info: GpuInfo[] };
  storageClasses: string[];
  cpus: CpuInfo[];
}

export interface ClusterState {
  nodes?: NodeState[];
  storage?: Record<string, { class: string; quantity: RawPair }>;
  leasedIp?: RawPair;
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
  endpoints: Array<{
    kind: string;
    sequenceNumber: number;
  }>;
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
