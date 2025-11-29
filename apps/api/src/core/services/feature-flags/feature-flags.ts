export const FeatureFlags = {
  NOTIFICATIONS_ALERT_CREATE: "notifications_general_alerts_create",
  NOTIFICATIONS_ALERT_UPDATE: "notifications_general_alerts_update",
  ANONYMOUS_FREE_TRIAL: "anonymous_free_trial",
  AUTO_CREDIT_RELOAD: "auto_credit_reload"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
