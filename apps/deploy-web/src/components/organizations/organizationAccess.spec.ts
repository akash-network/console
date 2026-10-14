import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import { canChangeDeployments, canManageBilling, canManageProjects, isLimitedToProjects, isProjectsUiEnabled } from "./organizationAccess";

describe("organizationAccess", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["member", false],
    ["billing", false],
    ["viewer", false]
  ] as const)("lets an %s manage projects: %s", (role, expected) => {
    expect(canManageProjects(role)).toBe(expected);
  });

  it.each([
    ["owner", true],
    ["admin", true],
    ["member", true],
    ["billing", false],
    ["viewer", false]
  ] as const)("lets an %s change deployments: %s", (role, expected) => {
    expect(canChangeDeployments(role)).toBe(expected);
  });

  it.each([
    ["owner", true],
    ["admin", false],
    ["member", false],
    ["billing", true],
    ["viewer", false]
  ] as const)("lets an %s manage billing: %s", (role, expected) => {
    expect(canManageBilling(role)).toBe(expected);
  });

  it("turns the projects experience on for a team organization only", () => {
    const team: OrganizationOutput = { id: "org-2", name: "Acme Corp", slug: "acme-corp", type: "team", role: "admin", isActive: true, createdAt: "" };

    expect(isProjectsUiEnabled(team)).toBe(true);
    expect(isProjectsUiEnabled({ ...team, type: "personal" })).toBe(false);
  });

  it.each([
    { type: "team", role: "member", expected: true },
    { type: "team", role: "viewer", expected: true },
    { type: "team", role: "owner", expected: false },
    { type: "team", role: "admin", expected: false },
    { type: "team", role: "billing", expected: true },
    { type: "personal", role: "owner", expected: false },
    { type: "personal", role: "viewer", expected: false }
  ] as const)("limits a $role of a $type organization to its projects: $expected", ({ type, role, expected }) => {
    expect(isLimitedToProjects(mock<OrganizationOutput>({ type, role }))).toBe(expected);
  });
});
