import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ChainEventsConfig } from "@src/modules/chain/config";
import { FeatureFlags } from "../feature-flags/feature-flags";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";

@Injectable()
export class RpcUrlResolverService {
  constructor(
    private readonly configService: ConfigService<ChainEventsConfig>,
    private readonly featureFlagsService: FeatureFlagsService
  ) {}

  async getRpcUrl(): Promise<string> {
    const useProxyUrls = this.featureFlagsService.isEnabled(FeatureFlags.USE_PROXY_URLS);
    const proxyRpcUrl = this.configService.getOrThrow("chain.PROXY_RPC_URL");
    const directRpcUrl = this.configService.getOrThrow("chain.RPC_NODE_ENDPOINT");

    if (useProxyUrls && proxyRpcUrl) {
      return proxyRpcUrl;
    }

    return directRpcUrl;
  }
}
