import type { OrganizationRole } from "@src/types/organization";
import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import { ORGANIZATION_ROLE_LABELS } from "./organizationAccess";

export type AssignableRole = Extract<OrganizationRole, "admin" | "member">;

export const ASSIGNABLE_ROLES: AssignableRole[] = ["member", "admin"];

export const ASSIGNABLE_ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  member: "Creates projects and manages deployments.",
  admin: "Also manages billing, usage and members."
};

export function describeRoleWithArticle(role: OrganizationRole): string {
  const label = ORGANIZATION_ROLE_LABELS[role];
  return `${/^[AEIOU]/.test(label) ? "an" : "a"} ${label}`;
}

export function getMemberDisplayName(member: Pick<OrganizationMemberOutput, "username" | "email">): string {
  return member.username || member.email || "Unnamed member";
}

/** Ranks the roster: owners first, then admins, then everyone else. */
export function getRoleRank(role: OrganizationRole): number {
  if (role === "owner") return 0;
  if (role === "admin") return 1;
  return 2;
}
