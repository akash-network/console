import { netConfigData } from "./generated/netConfigData";

export type SupportedChainNetworks = keyof typeof netConfigData;

export class NetConfig {
  getBaseAPIUrl(network: SupportedChainNetworks): string {
    return netConfigData[network].apiUrls[0];
  }
}
