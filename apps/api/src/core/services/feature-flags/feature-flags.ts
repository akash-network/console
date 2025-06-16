export const FeatureFlags = {
  NOTIFICATIONS_ALERT_MUTATION: "notifications_general_alerts_create_update"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
