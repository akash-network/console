export const FeatureFlags = {
  NOTIFICATIONS_ALERT_CREATE: "notifications_general_alerts_create",
  NOTIFICATIONS_ALERT_UPDATE: "notifications_general_alerts_update",
  AUTO_CREDIT_RELOAD: "auto_credit_reload",
  TRIAL_FINGERPRINT_CHECK: "trial_fingerprint_check",
  FAIR_USE_POLICY_GATE: "fair_use_policy_gate"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
