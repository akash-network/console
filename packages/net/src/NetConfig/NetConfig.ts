import { netConfigData } from "../generated/netConfigData";

export type SupportedChainNetworks = keyof typeof netConfigData;

type NetworkMapReverse = "sandbox" | "testnet" | "mainnet";
export class NetConfig {
  readonly networkMap: Partial<Record<NetworkMapReverse, SupportedChainNetworks>> = {
    sandbox: "sandbox-2",
    testnet: "testnet-7",
    mainnet: "mainnet"
  };

  readonly networkMapReverse: Partial<Record<SupportedChainNetworks, NetworkMapReverse>> = {
    "sandbox-2": "sandbox",
    "testnet-7": "testnet",
    mainnet: "mainnet"
  };

  mapped(network: NetworkMapReverse | SupportedChainNetworks | string): SupportedChainNetworks {
    if (this.networkMap[network as NetworkMapReverse]) {
      return this.networkMap[network as NetworkMapReverse] as SupportedChainNetworks;
    }

    if (network in netConfigData) {
      return network as SupportedChainNetworks;
    }

    throw new Error(`Network ${network} not supported`);
  }

  mappedReverse(network: SupportedChainNetworks): NetworkMapReverse {
    if (this.networkMapReverse[network]) {
      return this.networkMapReverse[network];
    }

    if (network in this.networkMapReverse) {
      return network as NetworkMapReverse;
    }

    throw new Error(`Network ${network} not supported`);
  }

  getVersion(network: SupportedChainNetworks): string | null {
    return netConfigData[this.mapped(network)].version;
  }

  getBaseAPIUrl(network: SupportedChainNetworks): string {
    const apiUrls = netConfigData[this.mapped(network)].apiUrls;
    return apiUrls[0];
  }

  getSupportedNetworks(): SupportedChainNetworks[] {
    return Object.keys(netConfigData) as SupportedChainNetworks[];
  }

  getFaucetUrl(network: SupportedChainNetworks): string | null {
    return netConfigData[this.mapped(network)].faucetUrl;
  }

  getBaseRpcUrl(network: SupportedChainNetworks): string {
    const rpcUrls = netConfigData[this.mapped(network)].rpcUrls;
    return rpcUrls[0];
  }
}
