import { describe, expect, it } from "vitest";

import type { OrganizationOutput } from "@src/types/organization";
import { canChangeDeployments, canManageProjects, isProjectsUiEnabled } from "./organizationAccess";

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

  it("turns the projects experience on for a team organization only", () => {
    const team: OrganizationOutput = { id: "org-2", name: "Acme Corp", slug: "acme-corp", type: "team", role: "admin", isActive: true, createdAt: "" };

    expect(isProjectsUiEnabled(team)).toBe(true);
    expect(isProjectsUiEnabled({ ...team, type: "personal" })).toBe(false);
  });
});
