import { NetworkId } from "@akashnetwork/akashjs/build/types/network";

type ApiVersion = "v1beta2" | "v1beta3" | "v1beta4";

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
  apiVersion: ApiVersion;
  marketApiVersion: ApiVersion;
};
