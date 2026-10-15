import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./useProjectAccess";
import { useProjectAccess } from "./useProjectAccess";

import { act, renderHook } from "@testing-library/react";
import { buildProject } from "@tests/seeders/project";

describe(useProjectAccess.name, () => {
  it("allows everything and reads nothing while organizations are off", () => {
    const { result, useProjectsQuery } = setup({ isOrganizationsEnabled: false, role: "viewer", projects: [] });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasNoProjects).toBe(false);
    expect(result.current.canManageDeployments("storefront")).toBe(true);
    expect(result.current.canDeployAnywhere).toBe(true);
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("allows everything in an organization that does not use projects", () => {
    const { result, useProjectsQuery } = setup({ projectsEnabled: false, role: "member" });

    expect(result.current.canManageDeployments(undefined)).toBe(true);
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("decides nothing while the organization is loading", () => {
    const { result } = setup({ isLoadingOrganization: true, role: "member", projects: [] });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasNoProjects).toBe(false);
    expect(result.current.canManageDeployments("storefront")).toBe(false);
    expect(result.current.canManageAccess("storefront")).toBe(false);
    expect(result.current.canDeployAnywhere).toBe(false);
  });

  it.each(["owner", "admin"] as const)("lets an %s manage every project without reading the projects", role => {
    const { result, useProjectsQuery } = setup({ role });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.canManageDeployments("storefront")).toBe(true);
    expect(result.current.canManageDeployments(null)).toBe(true);
    expect(result.current.canManageAccess("storefront")).toBe(true);
    expect(result.current.canDeployAnywhere).toBe(true);
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it.each(["member", "viewer", "billing"] as const)("reads what an organization %s may do from the project list", role => {
    const { useProjectsQuery } = setup({ role });

    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("lets the caller manage deployments only where the list says it may deploy", () => {
    const { result } = setup({
      role: "member",
      projects: [project("storefront", { canDeploy: true }), project("internal", { canDeploy: true, canManage: true }), project("marketing", {})]
    });

    expect(result.current.canManageDeployments("storefront")).toBe(true);
    expect(result.current.canManageDeployments("internal")).toBe(true);
    expect(result.current.canManageDeployments("marketing")).toBe(false);
    expect(result.current.canManageDeployments("ungranted")).toBe(false);
    expect(result.current.canManageDeployments(null)).toBe(false);
    expect(result.current.canManageDeployments(undefined)).toBe(false);
  });

  it("lets the caller manage access only to the projects the list says it manages", () => {
    const { result } = setup({
      role: "member",
      projects: [project("storefront", { canDeploy: true }), project("internal", { canDeploy: true, canManage: true })]
    });

    expect(result.current.canManageAccess("internal")).toBe(true);
    expect(result.current.canManageAccess("storefront")).toBe(false);
    expect(result.current.canManageAccess("ungranted")).toBe(false);
  });

  it("knows when the caller may deploy into at least one project", () => {
    const { result } = setup({ role: "member", projects: [project("storefront", {}), project("marketing", { canDeploy: true })] });

    expect(result.current.canDeployAnywhere).toBe(true);
  });

  it("knows when the caller may only look at every project", () => {
    const { result } = setup({ role: "viewer", projects: [project("storefront", {}), project("marketing", {})] });

    expect(result.current.canDeployAnywhere).toBe(false);
    expect(result.current.canManageDeployments("storefront")).toBe(false);
  });

  it("knows when a caller who reaches projects only through grants holds none", () => {
    const { result } = setup({ role: "member", projects: [] });

    expect(result.current.hasNoProjects).toBe(true);
    expect(result.current.canDeployAnywhere).toBe(false);
  });

  it("knows a caller with a grant has projects", () => {
    const { result } = setup({ role: "viewer" });

    expect(result.current.hasNoProjects).toBe(false);
  });

  it("does not claim no projects when they could not be read", () => {
    const { result } = setup({ role: "member", projects: null, isProjectsError: true });

    expect(result.current.hasNoProjects).toBe(false);
  });

  it("says the projects could not be read, denies everything until then, and reads them again on retry", () => {
    const { result, refetchProjects } = setup({ role: "member", projects: null, isProjectsError: true });

    expect(result.current).toMatchObject({ isLoading: false, isError: true, canDeployAnywhere: false });
    expect(result.current.canManageDeployments("storefront")).toBe(false);

    act(() => result.current.retry());

    expect(refetchProjects).toHaveBeenCalledTimes(1);
  });

  it("keeps the projects it read when a later read of them fails", () => {
    const { result } = setup({ role: "member", isProjectsError: true, projects: [project("storefront", { canDeploy: true })] });

    expect(result.current.isError).toBe(false);
    expect(result.current.canManageDeployments("storefront")).toBe(true);
  });

  it.each([
    { case: "an owner", role: "owner" as const },
    { case: "an organization member", role: "member" as const },
    { case: "anyone while the organization loads", role: "member" as const, isLoadingOrganization: true }
  ])("reports no read error for $case", ({ role, isLoadingOrganization }) => {
    const { result } = setup({ role, isLoadingOrganization });

    expect(result.current.isError).toBe(false);
    expect(result.current.retry()).toBeUndefined();
  });

  it.each(["owner", "admin"] as const)("never tells an %s they have no projects", role => {
    const { result } = setup({ role, projects: [] });

    expect(result.current.hasNoProjects).toBe(false);
  });

  it("decides nothing while the projects are loading", () => {
    const { result } = setup({ role: "member", isLoadingProjects: true });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.canDeployAnywhere).toBe(false);
  });

  function project(id: string, access: Partial<Project["access"]>): Project {
    return buildProject({ id, access: { canDeploy: false, canManage: false, ...access } });
  }

  function setup(input: {
    role: OrganizationRole;
    isOrganizationsEnabled?: boolean;
    projectsEnabled?: boolean;
    isLoadingOrganization?: boolean;
    isLoadingProjects?: boolean;
    isProjectsError?: boolean;
    projects?: Project[] | null;
  }) {
    const projects = input.projects === null ? undefined : input.projects ?? [project("storefront", {}), project("marketing", {})];
    const refetchProjects = vi.fn();
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() =>
      input.isLoadingProjects
        ? mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: undefined, isLoading: true, isError: false, refetch: refetchProjects })
        : mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({
            data: projects,
            isLoading: false,
            isError: input.isProjectsError ?? false,
            refetch: refetchProjects
          })
    );
    const dependencies: typeof DEPENDENCIES = {
      useFlag: flag => flag === "organizations" && (input.isOrganizationsEnabled ?? true),
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization: { id: "org-1", name: "Acme Corp", slug: "acme-corp", type: "team", role: input.role, isActive: true, createdAt: "" },
          isLoading: input.isLoadingOrganization ?? false,
          projectsEnabled: input.projectsEnabled ?? true
        }),
      useProjectsQuery
    };

    const hook = renderHook(() => useProjectAccess(dependencies));

    return { ...hook, useProjectsQuery, refetchProjects };
  }
});
