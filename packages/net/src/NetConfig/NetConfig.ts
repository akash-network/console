import { netConfigData } from "../generated/netConfigData";

export type SupportedChainNetworks = keyof typeof netConfigData;

export class NetConfig {
  readonly networkMap: Partial<Record<string, SupportedChainNetworks>> = {
    sandbox: "sandbox-2"
  };

  mapped(network: string): SupportedChainNetworks {
    if (this.networkMap[network]) {
      return this.networkMap[network];
    }

    if (network in netConfigData) {
      return network as SupportedChainNetworks;
    }

    throw new Error(`Network ${network} not supported`);
  }

  getVersion(network: string): string | null {
    return netConfigData[this.mapped(network)].version;
  }

  getBaseAPIUrl(network: string): string {
    const apiUrls = netConfigData[this.mapped(network)].apiUrls;
    return apiUrls[0];
  }

  getSupportedNetworks(): SupportedChainNetworks[] {
    return Object.keys(netConfigData) as SupportedChainNetworks[];
  }

  getFaucetUrl(network: string): string | null {
    return netConfigData[this.mapped(network)].faucetUrl;
  }

  getBaseRpcUrl(network: string): string {
    const rpcUrls = netConfigData[this.mapped(network)].rpcUrls;
    return rpcUrls[0];
  }
}
