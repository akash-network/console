import type { OrganizationRole } from "@src/types/organization";
import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import { ORGANIZATION_ROLE_LABELS } from "./organizationAccess";

export type AssignableRole = Exclude<OrganizationRole, "owner">;

export const ASSIGNABLE_ROLES: AssignableRole[] = ["member", "viewer", "billing", "admin"];

export const ASSIGNABLE_ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  member: "Deploys in the projects they can access, but can't create projects.",
  viewer: "Sees deployments and logs in the projects they can access, but can't change them.",
  billing: "Adds credits, manages payment methods and sees usage, but not deployments.",
  admin: "Creates projects, manages members and sees billing and usage."
};

export function describeRoleWithArticle(role: OrganizationRole): string {
  const noun = role === "billing" ? "Billing manager" : ORGANIZATION_ROLE_LABELS[role];
  return `${/^[AEIOU]/.test(noun) ? "an" : "a"} ${noun}`;
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
