/** Every deliberate exception to organization scoping, so the full set can be listed and reviewed in one place. */
export const UNSCOPED_REASONS = [
  "account-deletion",
  "active-organization-resolution",
  "api-key-authentication",
  "email-domain-account-checks",
  "gpu-driver-statistics",
  "own-memberships",
  "personal-organization-provisioning",
  "platform-statistics",
  "public-templates"
] as const;

export type UnscopedReason = (typeof UNSCOPED_REASONS)[number];
