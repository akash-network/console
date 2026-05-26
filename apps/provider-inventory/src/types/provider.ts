import type { ClusterState } from "./inventory.types";

export interface ProviderWithClusterState {
  owner: string;
  hostUri: string;
  cluster: ClusterState;
}
