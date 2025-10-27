import { type NetworkId } from "@akashnetwork/chain-sdk/web";

type ApiVersion = "v1beta2" | "v1beta3" | "v1beta4" | "v1beta5" | "v1";

export type Network = {
  id: NetworkId;
  title: string;
  description: string;
  nodesUrl: string;
  chainId: string;
  chainRegistryName: string;
  versionUrl: string;
  rpcEndpoint?: string;
  version: string | null;
  enabled: boolean;
  deploymentVersion: ApiVersion;
  marketVersion: ApiVersion;
  escrowVersion: ApiVersion;
  certVersion: ApiVersion;
  providerVersion: ApiVersion;
};
