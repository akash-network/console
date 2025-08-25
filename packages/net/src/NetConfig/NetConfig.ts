import { netConfigData } from "../generated/netConfigData";

export type SupportedChainNetworks = keyof typeof netConfigData;

export interface NetConfigOptions {
  useProxyUrls?: boolean;
  proxyApiUrl?: string;
  proxyRpcUrl?: string;
}

export class NetConfig {
  private options: NetConfigOptions;

  constructor(options: NetConfigOptions = {}) {
    this.options = {
      useProxyUrls: false,
      proxyApiUrl: "https://rpc.akt.dev/rest",
      proxyRpcUrl: "https://rpc.akt.dev/rpc",
      ...options
    };
  }

  getBaseAPIUrl(network: SupportedChainNetworks): string {
    if (this.options.useProxyUrls && this.options.proxyApiUrl && network === "mainnet") {
      return this.options.proxyApiUrl;
    }

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
    if (this.options.useProxyUrls && this.options.proxyRpcUrl && network === "mainnet") {
      return this.options.proxyRpcUrl;
    }

    const rpcUrls = netConfigData[network].rpcUrls;
    return rpcUrls[0];
  }

  setOptions(options: Partial<NetConfigOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getOptions(): NetConfigOptions {
    return { ...this.options };
  }
}
