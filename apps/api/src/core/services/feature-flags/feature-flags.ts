export const FeatureFlags = {
  NOTIFICATIONS_ALERT_CREATE: "notifications_general_alerts_create",
  NOTIFICATIONS_ALERT_UPDATE: "notifications_general_alerts_update",
  AUTO_CREDIT_RELOAD: "auto_credit_reload",
  EXTERNAL_TX_SIGNER: "external_tx_signer"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
