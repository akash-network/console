export const FeatureFlags = {
  NOTIFICATIONS_ALERT_CREATE: "notifications_general_alerts_create",
  NOTIFICATIONS_ALERT_UPDATE: "notifications_general_alerts_update",
  AUTO_CREDIT_RELOAD: "auto_credit_reload",
  EXTERNAL_TX_SIGNER: "external_tx_signer",
  TRIAL_FINGERPRINT_CHECK: "trial_fingerprint_check",
  TEMPLATE_RECOMMENDED_IDS: "template_recommended_ids",
  TEMPLATE_POPULAR_IDS: "template_popular_ids",
  TEMPLATE_CATEGORY_PRIORITY: "template_category_priority"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
