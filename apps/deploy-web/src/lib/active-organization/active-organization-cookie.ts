export const ACTIVE_ORGANIZATION_COOKIE_NAME = "console_org";
export const ACTIVE_ORGANIZATION_HEADER_NAME = "x-organization-id";

const ACTIVE_ORGANIZATION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** An organization uuid or slug, which the API resolves either way. */
const ACTIVE_ORGANIZATION_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

export function readActiveOrganizationCookie(cookieHeader: string | null | undefined): string | undefined {
  const cookiePrefix = `${ACTIVE_ORGANIZATION_COOKIE_NAME}=`;
  const value = cookieHeader
    ?.split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(cookiePrefix))
    ?.slice(cookiePrefix.length);

  return value && ACTIVE_ORGANIZATION_ID_PATTERN.test(value) ? value : undefined;
}

export function serializeActiveOrganizationCookie(organizationId: string): string {
  return `${ACTIVE_ORGANIZATION_COOKIE_NAME}=${organizationId}; Path=/; Max-Age=${ACTIVE_ORGANIZATION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
