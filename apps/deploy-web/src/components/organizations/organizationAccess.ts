import type { OrganizationOutput, OrganizationRole, OrganizationType } from "@src/types/organization";

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  billing: "Billing",
  viewer: "Viewer"
};

export const canViewBillingAndUsage = (role: OrganizationRole): boolean => role !== "member" && role !== "viewer";

/** Off until the members page ships, so no link leads to it before then. */
export const hasMembersPage = (_type: OrganizationType): boolean => false;

/** Off until the projects pages ship, so switching into a team organization lands on its deployments before then. */
export const isProjectsUiEnabled = (_organization: OrganizationOutput): boolean => false;
