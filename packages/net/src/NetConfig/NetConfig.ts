import { netConfigData } from "../generated/netConfigData";

export type SupportedChainNetworks = keyof typeof netConfigData;

export class NetConfig {
  getBaseAPIUrl(network: SupportedChainNetworks): string {
    const apiUrls = netConfigData[network].apiUrls;
    return apiUrls[0];
  }

  getSupportedNetworks(): SupportedChainNetworks[] {
    return Object.keys(netConfigData) as SupportedChainNetworks[];
  }

  getFaucetUrl(network: SupportedChainNetworks): string | null {
    switch (network) {
      case "sandbox":
        return "https://faucet.sandbox-01.aksh.pw/faucet";
      default:
        return null;
    }
  }

  getBaseRpcUrl(network: SupportedChainNetworks): string {
    const rpcUrls = netConfigData[network].rpcUrls;
    return rpcUrls[0];
  }
}
