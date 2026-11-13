import type { OrganizationContext } from "@src/organization/types/organization-context";

/** Identity headers reserved for the notifications service, which the proxy strips from clients and mints from the request context. */
export const NOTIFICATIONS_IDENTITY_HEADERS = {
  userId: "x-user-id",
  ownerAddress: "x-owner-address",
  organizationId: "x-organization-id",
  organizationType: "x-organization-type",
  organizationRole: "x-organization-role",
  projectScope: "x-project-scope",
  projectId: "x-project-id",
  userEmail: "x-user-email",
  userEmailVerified: "x-user-email-verified"
} as const;

const IDENTITY_HEADER_NAMES: ReadonlySet<string> = new Set(Object.values(NOTIFICATIONS_IDENTITY_HEADERS));

export function stripIdentityHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !IDENTITY_HEADER_NAMES.has(name.toLowerCase())));
}

/** Only an email Auth0 reports verified is named as verified, since the notifications service confirms it on the requester's channels without asking. */
export function accountEmailHeaders({ email, verifiedEmail }: { email?: string | null; verifiedEmail: string | null }): Record<string, string> {
  if (verifiedEmail) {
    return { [NOTIFICATIONS_IDENTITY_HEADERS.userEmail]: verifiedEmail, [NOTIFICATIONS_IDENTITY_HEADERS.userEmailVerified]: "true" };
  }

  if (!email) {
    return {};
  }

  return { [NOTIFICATIONS_IDENTITY_HEADERS.userEmail]: email, [NOTIFICATIONS_IDENTITY_HEADERS.userEmailVerified]: "false" };
}

export function organizationIdentityHeaders(context: OrganizationContext): Record<string, string> {
  return {
    [NOTIFICATIONS_IDENTITY_HEADERS.organizationId]: context.organizationId,
    [NOTIFICATIONS_IDENTITY_HEADERS.organizationType]: context.organizationType,
    [NOTIFICATIONS_IDENTITY_HEADERS.organizationRole]: context.role,
    [NOTIFICATIONS_IDENTITY_HEADERS.projectScope]: JSON.stringify(context.projectScope)
  };
}
