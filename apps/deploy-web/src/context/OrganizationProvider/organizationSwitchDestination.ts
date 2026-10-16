import { canViewBillingAndUsage, hasGeneralSettingsPage, hasMembersPage, isProjectsUiEnabled } from "@src/components/organizations/organizationAccess";
import type { OrganizationOutput } from "@src/types/organization";
import { isRouteActive } from "@src/utils/isRouteActive";
import { UrlService } from "@src/utils/urlUtils";

const ORGANIZATION_NEUTRAL_PREFIXES = ["/templates", "/providers", "/user/api-keys", "/alerts", "/user/settings", "/profile"];

/** Pages that read the same for every organization stay put; every other page, a project's included, goes to the landing page. */
export function resolveOrganizationSwitchDestination(currentUrl: string, target: OrganizationOutput | undefined): string {
  if (!target) return UrlService.deploymentList();

  const pathname = currentUrl.split(/[?#]/)[0];
  const landingPage = isProjectsUiEnabled(target) ? UrlService.projects() : UrlService.deploymentList();
  if (pathname === landingPage || isRouteActive(pathname, ...stayPutPrefixesFor(target))) return currentUrl;

  return landingPage;
}

function stayPutPrefixesFor(target: OrganizationOutput): string[] {
  return [
    ...ORGANIZATION_NEUTRAL_PREFIXES,
    ...(hasGeneralSettingsPage(target.type) ? ["/organization"] : []),
    ...(hasMembersPage(target.type) ? ["/members"] : []),
    ...(canViewBillingAndUsage(target.role) ? ["/billing", "/usage"] : [])
  ];
}
