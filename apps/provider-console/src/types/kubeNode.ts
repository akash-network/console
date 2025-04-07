export interface KubeNode {
  name: string;
  status: string; // Consider using a boolean or specific enum if status values are fixed
  roles: string; // Could be string[] if roles are always comma-separated
  age: string; // ISO Date string
  version: string;
  internalIP: string;
  externalIP: string; // Might be optional or empty string?
  osImage: string;
  kernelVersion: string;
  containerRuntime: string;
}

export interface KubeNodesResponse {
  nodes: KubeNode[];
}
