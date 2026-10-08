/** Every header the api mints for the notifications service is listed here, so the proxy drops any copy a client sends. */
export const NOTIFICATIONS_IDENTITY_HEADERS = {
  userId: "x-user-id",
  ownerAddress: "x-owner-address",
  organizationId: "x-organization-id",
  organizationRole: "x-organization-role",
  projectScope: "x-project-scope",
  projectId: "x-project-id"
} as const;

const IDENTITY_HEADER_NAMES: ReadonlySet<string> = new Set(Object.values(NOTIFICATIONS_IDENTITY_HEADERS));

export function stripIdentityHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !IDENTITY_HEADER_NAMES.has(name.toLowerCase())));
}
