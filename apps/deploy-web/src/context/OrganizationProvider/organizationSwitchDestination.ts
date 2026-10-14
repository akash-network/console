import { canViewBillingAndUsage, hasMembersPage, isProjectsUiEnabled } from "@src/components/organizations/organizationAccess";
import type { OrganizationOutput } from "@src/types/organization";
import { isRouteActive } from "@src/utils/isRouteActive";
import { UrlService } from "@src/utils/urlUtils";

const ORGANIZATION_NEUTRAL_PREFIXES = ["/projects", "/templates", "/providers", "/user/api-keys", "/alerts", "/user/settings", "/profile"];

/** Pages that read the same for every organization keep the user where they are; every other page goes to the organization's landing page. */
export function resolveOrganizationSwitchDestination(currentUrl: string, target: OrganizationOutput | undefined): string {
  if (!target) return UrlService.deploymentList();

  const pathname = currentUrl.split(/[?#]/)[0];
  if (isRouteActive(pathname, ...stayPutPrefixesFor(target))) return currentUrl;

  return isProjectsUiEnabled(target) ? UrlService.projects() : UrlService.deploymentList();
}

function stayPutPrefixesFor(target: OrganizationOutput): string[] {
  return [
    ...ORGANIZATION_NEUTRAL_PREFIXES,
    ...(hasMembersPage(target.type) ? ["/members"] : []),
    ...(canViewBillingAndUsage(target.role) ? ["/billing", "/usage"] : [])
  ];
}
