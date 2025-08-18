import { createNetConfig, type SupportedChainNetworks } from "@akashnetwork/net";
import { singleton } from "tsyringe";

import { env } from "../../../utils/env";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";

@singleton()
export class ChainConfigService {
  private readonly netConfig: ReturnType<typeof createNetConfig>;

  constructor(private readonly featureFlagsService: FeatureFlagsService) {
    this.netConfig = createNetConfig({
      useProxyUrls: this.featureFlagsService.isEnabled("use_proxy_urls"),
      proxyApiUrl: env.PROXY_API_URL,
      proxyRpcUrl: env.PROXY_RPC_URL
    });
  }

  getBaseAPIUrl(): string {
    return this.netConfig.getBaseAPIUrl(env.NETWORK as SupportedChainNetworks);
  }

  getBaseRpcUrl(): string {
    return this.netConfig.getBaseRpcUrl(env.NETWORK as SupportedChainNetworks);
  }

  getSupportedNetworks(): SupportedChainNetworks[] {
    return this.netConfig.getSupportedNetworks();
  }

  getFaucetUrl(network: SupportedChainNetworks): string | null {
    return this.netConfig.getFaucetUrl(network);
  }
}
