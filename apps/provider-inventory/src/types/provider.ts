import type { ClusterState } from "./inventory.types";

export interface ProviderWithClusterState {
  owner: string;
  hostUri: string;
  ipRegion?: string | null;
  uptime7d?: number | null;
  cluster: ClusterState;
}
