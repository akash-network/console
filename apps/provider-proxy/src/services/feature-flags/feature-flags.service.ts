import type { FeatureFlagValue } from "./feature-flags";

export class FeatureFlagsService {
  constructor() {}

  isEnabled(featureFlag: FeatureFlagValue): boolean {
    switch (featureFlag) {
      case "use_proxy_urls":
        return process.env.USE_PROXY_URLS === "true";
      default:
        return false;
    }
  }

  async isEnabledAsync(featureFlag: FeatureFlagValue): Promise<boolean> {
    return this.isEnabled(featureFlag);
  }
}
