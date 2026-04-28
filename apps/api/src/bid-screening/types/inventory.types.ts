import type { ResourcePair } from "../lib/resource-pair";

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

export interface ResourcePairState {
  allocatable: bigint;
  allocated: bigint;
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
  attributes: ResourceAttribute[];
}

export interface ResourceAttribute {
  key: string;
  value: string;
}

export interface RequestedResources {
  cpu: { units: bigint; attributes: ResourceAttribute[] };
  gpu: { units: bigint; attributes: ResourceAttribute[] };
  memory: { quantity: bigint; attributes: ResourceAttribute[] };
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
  region: string | null;
  uptime7d: number | null;
  isAudited: boolean;
}

export type ToJSON<T> = T extends Uint8Array
  ? string
  : T extends object
    ? { -readonly [K in keyof T]: ToJSON<Exclude<T[K], undefined>> }
    : T extends bigint
      ? string
      : T;
