import type { OrganizationContext } from "@src/organization/types/organization-context";

/** Identity headers reserved for the notifications service, which the proxy strips from clients and mints from the request context. */
export const NOTIFICATIONS_IDENTITY_HEADERS = {
  userId: "x-user-id",
  ownerAddress: "x-owner-address",
  organizationId: "x-organization-id",
  organizationType: "x-organization-type",
  organizationRole: "x-organization-role",
  projectScope: "x-project-scope",
  projectId: "x-project-id"
} as const;

const IDENTITY_HEADER_NAMES: ReadonlySet<string> = new Set(Object.values(NOTIFICATIONS_IDENTITY_HEADERS));

export function stripIdentityHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !IDENTITY_HEADER_NAMES.has(name.toLowerCase())));
}

/** The role and project scope travel only when organization rules are authoritative, which is how the notifications service tells the two modes apart. */
export function organizationIdentityHeaders(context: OrganizationContext): Record<string, string> {
  const headers = {
    [NOTIFICATIONS_IDENTITY_HEADERS.organizationId]: context.organizationId,
    [NOTIFICATIONS_IDENTITY_HEADERS.organizationType]: context.organizationType
  };

  if (context.mode === "legacy") {
    return headers;
  }

  return {
    ...headers,
    [NOTIFICATIONS_IDENTITY_HEADERS.organizationRole]: context.role,
    [NOTIFICATIONS_IDENTITY_HEADERS.projectScope]: JSON.stringify(context.projectScope)
  };
}
