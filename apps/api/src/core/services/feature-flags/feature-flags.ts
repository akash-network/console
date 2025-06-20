export const FeatureFlags = {
  NOTIFICATIONS_ALERT_CREATE: "notifications_general_alerts_create",
  NOTIFICATIONS_ALERT_UPDATE: "notifications_general_alerts_update"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
