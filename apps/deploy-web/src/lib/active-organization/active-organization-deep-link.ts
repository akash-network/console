export const ACTIVE_ORGANIZATION_QUERY_PARAM = "org";

const RELATIVE_PATH_BASE = "http://localhost";

export function resolveActiveOrganizationDeepLink(
  orgQueryValue: string | string[] | null | undefined,
  memberships: readonly { id: string; slug: string }[]
): string | null {
  return memberships.find(organization => organization.id === orgQueryValue || organization.slug === orgQueryValue)?.id ?? null;
}

export function removeActiveOrganizationQueryParam(asPath: string): string {
  const url = new URL(asPath, RELATIVE_PATH_BASE);
  url.searchParams.delete(ACTIVE_ORGANIZATION_QUERY_PARAM);

  return `${url.pathname}${url.search}${url.hash}`;
}
