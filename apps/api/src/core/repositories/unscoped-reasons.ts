/** Every deliberate exception to organization scoping, so the full set can be listed and reviewed in one place. */
export const UNSCOPED_REASONS = [
  "account-deletion",
  "active-organization-resolution",
  "api-key-authentication",
  "api-key-expiry-reminders",
  "deployment-activity",
  "deployment-location",
  "email-domain-account-checks",
  "gpu-driver-statistics",
  "invitation-by-token",
  "invitation-email-limits",
  "invitation-email-retention",
  "member-access-validation",
  "member-project-grants",
  "organization-creation",
  "organization-deletion",
  "own-memberships",
  "per-person-billing-limits",
  "personal-organization-provisioning",
  "platform-statistics",
  "public-templates",
  "wallet-provisioning"
] as const;

export type UnscopedReason = (typeof UNSCOPED_REASONS)[number];
