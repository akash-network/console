import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ChainEventsConfig } from "@src/modules/chain/config";
import type { FeatureFlagValue } from "./feature-flags";

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly configService: ConfigService<ChainEventsConfig>) {}

  isEnabled(featureFlag: FeatureFlagValue): boolean {
    switch (featureFlag) {
      case "use_proxy_urls":
        return this.configService.get("chain.USE_PROXY_URLS") === "true";
      default:
        return false;
    }
  }

  async isEnabledAsync(featureFlag: FeatureFlagValue): Promise<boolean> {
    return this.isEnabled(featureFlag);
  }
}
