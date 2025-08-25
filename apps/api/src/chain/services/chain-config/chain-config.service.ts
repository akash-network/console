import { createNetConfig, type SupportedChainNetworks } from "@akashnetwork/net";
import { singleton } from "tsyringe";

import { envSchema } from "@src/chain/config/env.config";
import { ConfigService } from "@src/core/services/config/config.service";
import { env } from "@src/utils/env";

@singleton()
export class ChainConfigService extends ConfigService<typeof envSchema> {
  private netConfig: ReturnType<typeof createNetConfig>;

  constructor() {
    super({ envSchema });
    this.netConfig = this.createNetConfig();
  }

  private createNetConfig(): ReturnType<typeof createNetConfig> {
    const useProxyUrls = env.USE_PROXY_URLS === "true";

    const config = {
      useProxyUrls,
      proxyApiUrl: env.PROXY_API_URL,
      proxyRpcUrl: env.PROXY_RPC_URL
    };

    return createNetConfig(config);
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
