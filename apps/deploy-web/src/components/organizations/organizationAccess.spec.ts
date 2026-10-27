import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import {
  canChangeDeployments,
  canDeleteOrganization,
  canManageBilling,
  canManageProjects,
  canRenameOrganization,
  canTransferOwnership,
  hasGeneralSettingsPage,
  isLimitedToProjects,
  landsOnProjects
} from "./organizationAccess";

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

  it.each([
    ["owner", true],
    ["admin", false],
    ["member", false],
    ["billing", false],
    ["viewer", false]
  ] as const)("lets an %s delete the organization: %s", (role, expected) => {
    expect(canDeleteOrganization(role)).toBe(expected);
  });

  it("lands a team organization on its projects and a personal account on its deployments", () => {
    expect(landsOnProjects("team")).toBe(true);
    expect(landsOnProjects("personal")).toBe(false);
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

  it("gives only a team organization a general settings page", () => {
    expect(hasGeneralSettingsPage("team")).toBe(true);
    expect(hasGeneralSettingsPage("personal")).toBe(false);
  });

  it.each([
    ["owner", true],
    ["admin", true],
    ["member", false],
    ["billing", false],
    ["viewer", false]
  ] as const)("lets an %s rename the organization: %s", (role, expected) => {
    expect(canRenameOrganization(role)).toBe(expected);
  });

  it.each([
    ["owner", true],
    ["admin", false],
    ["member", false],
    ["billing", false],
    ["viewer", false]
  ] as const)("lets an %s transfer ownership: %s", (role, expected) => {
    expect(canTransferOwnership(role)).toBe(expected);
  });
});
