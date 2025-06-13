export const FeatureFlags = {
  NOTIFICATIONS_ALERT_MUTATION: "notifications_general_alerts_create_update",
  CONSOLE_WEB_ANONYMOUS_USER_TRIAL: "console_web_anonymous_user_trial"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
