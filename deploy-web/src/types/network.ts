export type Network = {
  id: string;
  title: string;
  description: string;
  nodesUrl: string;
  chainId: string;
  versionUrl: string;
  rpcEndpoint?: string;
  version: string;
  enabled: boolean;
  suggestWalletChain?: () => Promise<void>;
};

