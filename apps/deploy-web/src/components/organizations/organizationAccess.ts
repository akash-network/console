import type { OrganizationOutput, OrganizationRole, OrganizationType } from "@src/types/organization";

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  billing: "Billing",
  viewer: "Viewer"
};

export const canViewBillingAndUsage = (role: OrganizationRole): boolean => role !== "member" && role !== "viewer";

/** Admins read the billing of an organization but only owners and billing members change it; the api refuses everyone else. */
export const canManageBilling = (role: OrganizationRole): boolean => role === "owner" || role === "billing";

/** The api scopes everyone in a team below owner and admin to the projects they were granted, which for billing is none. */
export const isLimitedToProjects = (organization: OrganizationOutput): boolean =>
  organization.type === "team" && organization.role !== "owner" && organization.role !== "admin";

export const hasMembersPage = (type: OrganizationType): boolean => type === "team";

/** A personal organization files everything into its default project, so only a team works in projects. */
export const isProjectsUiEnabled = (organization: OrganizationOutput): boolean => organization.type === "team";

export const canManageMembers = (role: OrganizationRole): boolean => role === "owner" || role === "admin";

export const canDeleteOrganization = (role: OrganizationRole): boolean => role === "owner";

/** Creating, renaming and deleting projects is for owners and admins; the api refuses everyone else. */
export const canManageProjects = (role: OrganizationRole): boolean => role === "owner" || role === "admin";

/** Viewers and billing members read deployments but cannot start, close or change them. */
export const canChangeDeployments = (role: OrganizationRole): boolean => role !== "viewer" && role !== "billing";

export const hasGeneralSettingsPage = (type: OrganizationType): boolean => type === "team";

export const canRenameOrganization = (role: OrganizationRole): boolean => role === "owner" || role === "admin";

export const canTransferOwnership = (role: OrganizationRole): boolean => role === "owner";
