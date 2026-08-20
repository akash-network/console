export const FeatureFlags = {
  NOTIFICATIONS_ALERT_CREATE: "notifications_general_alerts_create",
  NOTIFICATIONS_ALERT_UPDATE: "notifications_general_alerts_update",
  AUTO_CREDIT_RELOAD: "auto_credit_reload",
  AUTO_RELOAD_FIXED_THRESHOLD: "auto_reload_fixed_threshold",
  TRIAL_FINGERPRINT_CHECK: "trial_fingerprint_check",
  SDL_SECRETS_SEALED_INTAKE: "sdl_secrets_sealed_intake"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
