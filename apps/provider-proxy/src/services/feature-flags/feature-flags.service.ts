import { FeatureFlags, type FeatureFlagValue } from "./feature-flags";

export class FeatureFlagsService {
  constructor() {}

  isEnabled(featureFlag: FeatureFlagValue): boolean {
    switch (featureFlag) {
      case FeatureFlags.USE_PROXY_URLS:
        return process.env.USE_PROXY_URLS === "true";
      default:
        return false;
    }
  }
}
