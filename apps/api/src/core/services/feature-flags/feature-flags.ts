export const FeatureFlags = {
  NOTIFICATIONS_ALERT_CREATE: "notifications_general_alerts_create",
  NOTIFICATIONS_ALERT_UPDATE: "notifications_general_alerts_update",
  AUTO_CREDIT_RELOAD: "auto_credit_reload",
  TRIAL_FINGERPRINT_CHECK: "trial_fingerprint_check",
  FAIR_USE_POLICY_GATE: "fair_use_policy_gate",
  BLOCKED_EMAIL_DOMAIN_ENFORCEMENT: "blocked_email_domain_enforcement",
  ACCOUNT_DELETION: "account_deletion",
  ORGANIZATIONS: "organizations",
  ORGANIZATIONS_ENFORCE: "organizations_enforce",
  INVOICES: "invoices",
  BACKGROUND_AUTO_LEASE: "background_auto_lease",
  TEAM_DATA_KEYS: "team_data_keys",
  GPU_REQUEST_ROUTING: "gpu_request_routing",
  GPU_REQUEST_RESPONSE_TARGET_EMAILS: "gpu_request_response_target_emails",
  GPU_REQUEST_RESPONSE_TARGET_SLACK_ALERTS: "gpu_request_response_target_slack_alerts",
  USER_FEEDBACK_LOOP: "user_feedback_loop",
  AFFILIATE_PROGRAM: "affiliate_program",
  TEMPLATE_MARKETPLACE: "template_marketplace"
} as const;

export type FeatureFlagValue = (typeof FeatureFlags)[keyof typeof FeatureFlags];
