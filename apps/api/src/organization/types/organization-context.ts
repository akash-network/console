import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";

/** `projectIds` holds every project the request may read; the write levels are subsets of it. */
export type ProjectScope =
  | { kind: "all" }
  | { kind: "projects"; projectIds: readonly string[]; writableProjectIds: readonly string[]; adminProjectIds: readonly string[] };

export type AuthorizationMode = "organization" | "legacy";

export interface OrganizationContext {
  organizationId: string;
  organizationType: OrganizationType;
  role: OrganizationRole;
  projectScope: ProjectScope;
  mode: AuthorizationMode;
}
