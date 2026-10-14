import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";

import type { OrganizationRole } from "@src/types/organization";
import type { ProjectRole } from "@src/types/project";
import { PROJECT_ACCESS_ERROR_CODES } from "@src/types/project";

export const PROJECT_ROLES: ProjectRole[] = ["viewer", "member", "admin"];

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = { admin: "Admin", member: "Member", viewer: "Viewer" };

export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  viewer: "Sees the project and its deployments.",
  member: "Also deploys into the project and manages its deployments.",
  admin: "Also renames the project and manages who can open it."
};

/** Grants held by owners, admins or billing members have no effect, so only members and viewers are given one. */
const GRANTED_ORGANIZATION_ROLES: ReadonlySet<OrganizationRole> = new Set(["member", "viewer"]);

export const holdsProjectGrants = (role: OrganizationRole): boolean => GRANTED_ORGANIZATION_ROLES.has(role);

const PROJECT_ACCESS_ERROR_MESSAGES = new Map<string, string>([
  [PROJECT_ACCESS_ERROR_CODES.forbidden, "You can't manage access to this project."],
  [PROJECT_ACCESS_ERROR_CODES.implicitProjectAccess, "Owners and admins already open every project."],
  [PROJECT_ACCESS_ERROR_CODES.billingRoleNotGrantable, "Billing members can't be given access to projects."],
  [PROJECT_ACCESS_ERROR_CODES.alreadyGranted, "They already have access to this project."]
]);

/** The message for a grant the API refused with an error code, or the fallback for anything else. */
export function getProjectAccessErrorMessage(error: unknown, fallback: string): string {
  return PROJECT_ACCESS_ERROR_MESSAGES.get(extractApiErrorCode(error) ?? "") ?? fallback;
}
