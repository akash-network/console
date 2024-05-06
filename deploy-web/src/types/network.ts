import { NetworkId } from "@akashnetwork/akashjs/build/types/network";

export type Network = {
  id: NetworkId;
  title: string;
  description: string;
  nodesUrl: string;
  chainId: string;
  chainRegistryName: string;
  versionUrl: string;
  rpcEndpoint?: string;
  version: string;
  enabled: boolean;
};
