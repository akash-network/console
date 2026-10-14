import type { OrganizationOutput, OrganizationRole, OrganizationType } from "@src/types/organization";

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  billing: "Billing",
  viewer: "Viewer"
};

export const canViewBillingAndUsage = (role: OrganizationRole): boolean => role !== "member" && role !== "viewer";

export const hasMembersPage = (type: OrganizationType): boolean => type === "team";

/** Off until the projects pages ship, so switching into a team organization lands on its deployments before then. */
export const isProjectsUiEnabled = (_organization: OrganizationOutput): boolean => false;

export const canManageMembers = (role: OrganizationRole): boolean => role === "owner" || role === "admin";
