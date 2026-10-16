import type { OrganizationRole, ProjectAccess } from "@src/organization/model-schemas/organization-member/organization-member.schema";

/** Owners and admins reach every project whatever is stored, and billing members reach none, so only members and viewers read the stored access. */
export function effectiveProjectAccessOf(role: OrganizationRole, storedAccess: ProjectAccess): ProjectAccess | null {
  if (role === "owner" || role === "admin") return "all";
  if (role === "billing") return null;

  return storedAccess;
}
