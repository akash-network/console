import { netConfigData } from "../generated/netConfigData";

export type SupportedChainNetworks = keyof typeof netConfigData;

export class NetConfig {
  getVersion(network: SupportedChainNetworks): string | null {
    return netConfigData[network].version;
  }

  getBaseAPIUrl(network: SupportedChainNetworks): string {
    const apiUrls = netConfigData[network].apiUrls;
    return apiUrls[0];
  }

  getSupportedNetworks(): SupportedChainNetworks[] {
    return Object.keys(netConfigData) as SupportedChainNetworks[];
  }

  getFaucetUrl(network: SupportedChainNetworks): string | null {
    return netConfigData[network].faucetUrl;
  }

  getBaseRpcUrl(network: SupportedChainNetworks): string {
    const rpcUrls = netConfigData[network].rpcUrls;
    return rpcUrls[0];
  }
}
