import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { DEPENDENCIES } from "./useProjectsUi";
import { useProjectsUi } from "./useProjectsUi";

import { renderHook } from "@testing-library/react";

describe(useProjectsUi.name, () => {
  it("turns projects on for an organization that uses them while organizations are on", () => {
    const { result } = setup({ role: "member" });

    expect(result.current).toEqual({ isEnabled: true, canManageProjects: false, canChangeDeployments: true, organizationName: "Acme Corp" });
  });

  it("keeps projects off, and every deployment action on, while organizations are off", () => {
    const { result } = setup({ isOrganizationsEnabled: false, role: "viewer" });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.canManageProjects).toBe(false);
    expect(result.current.canChangeDeployments).toBe(true);
  });

  it("keeps projects off for an organization that does not use them", () => {
    const { result } = setup({ projectsEnabled: false, role: "owner" });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.canManageProjects).toBe(false);
  });

  it.each(["owner", "admin"] as const)("lets an %s manage projects", role => {
    const { result } = setup({ role });

    expect(result.current.canManageProjects).toBe(true);
  });

  it.each(["member", "billing", "viewer"] as const)("does not let a %s manage projects", role => {
    const { result } = setup({ role });

    expect(result.current.canManageProjects).toBe(false);
  });

  it.each(["viewer", "billing"] as const)("does not let a %s change deployments", role => {
    const { result } = setup({ role });

    expect(result.current.canChangeDeployments).toBe(false);
  });

  it("names no organization before one is active, and blocks nothing", () => {
    const { result } = setup({ role: undefined });

    expect(result.current.organizationName).toBe("");
    expect(result.current.canManageProjects).toBe(false);
    expect(result.current.canChangeDeployments).toBe(true);
  });

  function setup(input: { isOrganizationsEnabled?: boolean; projectsEnabled?: boolean; role: OrganizationRole | undefined }) {
    const dependencies: typeof DEPENDENCIES = {
      useFlag: flag => flag === "organizations" && (input.isOrganizationsEnabled ?? true),
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          projectsEnabled: input.projectsEnabled ?? true,
          activeOrganization: input.role
            ? { id: "org-1", name: "Acme Corp", slug: "acme-corp", type: "team", role: input.role, isActive: true, createdAt: "" }
            : undefined
        })
    };

    return renderHook(() => useProjectsUi(dependencies));
  }
});
