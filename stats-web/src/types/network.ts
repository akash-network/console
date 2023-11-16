export type Network = {
  id: string;
  title: string;
  description: string;
  nodesUrl: string;
  chainId: string;
  versionUrl: string;
  rpcEndpoint?: string;
  version: string | null;
  enabled: boolean;
  suggestWalletChain?: () => Promise<void>;
};

