import { netConfigData } from "./generated/netConfigData";

export type SupportedChainNetworks = keyof typeof netConfigData;

export class NetConfig {
  getBaseAPIUrl(network: SupportedChainNetworks): string {
    return netConfigData[network].apiUrls[1];
  }

  getSupportedNetworks(): SupportedChainNetworks[] {
    return Object.keys(netConfigData) as SupportedChainNetworks[];
  }
}
