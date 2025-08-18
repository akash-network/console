export const FeatureFlags = {
  USE_PROXY_URLS: "use_proxy_urls"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
