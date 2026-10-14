import type { PropsWithChildren } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { deployTargetProjectIdAtom } from "@src/store/deployTargetStore";
import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./useDeployTarget";
import { useDeployTarget } from "./useDeployTarget";

import { act, renderHook } from "@testing-library/react";

describe(useDeployTarget.name, () => {
  it("targets the project the page was opened for and remembers it for the create", () => {
    const { result, store } = setup({ requestedProjectId: "storefront" });

    expect(result.current.project?.id).toBe("storefront");
    expect(result.current.isMissing).toBe(false);
    expect(store.get(deployTargetProjectIdAtom)).toBe("storefront");
  });

  it("drops a project chosen earlier when the page names none, so a deployment started outside a project passes the picker", () => {
    const { result, store } = setup({ chosenProjectId: "marketing" });

    expect(result.current.project).toBeUndefined();
    expect(result.current.isMissing).toBe(true);
    expect(store.get(deployTargetProjectIdAtom)).toBeNull();
  });

  it("prefers the project the page was opened for over the one chosen last", () => {
    const { result } = setup({ requestedProjectId: "storefront", chosenProjectId: "marketing" });

    expect(result.current.project?.id).toBe("storefront");
  });

  it("asks for a project when none of the organization's is chosen", () => {
    const { result } = setup({ chosenProjectId: "elsewhere" });

    expect(result.current.project).toBeUndefined();
    expect(result.current.isMissing).toBe(true);
  });

  it("waits for the projects before asking", () => {
    const { result } = setup({ isLoading: true });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isMissing).toBe(false);
  });

  it("chooses a project for the next create", () => {
    const { result, store } = setup({});

    act(() => result.current.chooseProject("marketing"));

    expect(store.get(deployTargetProjectIdAtom)).toBe("marketing");
    expect(result.current.project?.id).toBe("marketing");
  });

  it("forgets the chosen project so the picker asks again", () => {
    const { result, store } = setup({});

    act(() => result.current.chooseProject("marketing"));
    act(() => result.current.forgetProject());

    expect(store.get(deployTargetProjectIdAtom)).toBeNull();
    expect(result.current.isMissing).toBe(true);
  });

  it("requires nothing and fetches nothing while projects are off", () => {
    const { result, store, useProjectsQuery } = setup({ isEnabled: false, requestedProjectId: "storefront" });

    expect(result.current).toMatchObject({ isRequired: false, isLoading: false, isMissing: false, project: undefined });
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
    expect(store.get(deployTargetProjectIdAtom)).toBeNull();
  });

  it("names the organization the deployment goes to", () => {
    const { result } = setup({});

    expect(result.current.organizationName).toBe("Acme Corp");
    expect(result.current.canCreateProject).toBe(true);
    expect(result.current.projects.map(project => project.id)).toEqual(["storefront", "marketing"]);
  });

  function setup(input: { isEnabled?: boolean; isLoading?: boolean; requestedProjectId?: string; chosenProjectId?: string }) {
    const projects = [mock<Project>({ id: "storefront", name: "storefront" }), mock<Project>({ id: "marketing", name: "marketing" })];
    const isEnabled = input.isEnabled ?? true;
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() =>
      input.isLoading
        ? mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: undefined, isLoading: true })
        : mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: projects, isLoading: false })
    );
    const dependencies: typeof DEPENDENCIES = {
      useProjectsUi: () => ({ isEnabled, canManageProjects: true, canChangeDeployments: true, organizationName: "Acme Corp" }),
      useProjectsQuery
    };
    const store = createStore();
    if (input.chosenProjectId) store.set(deployTargetProjectIdAtom, input.chosenProjectId);

    const hook = renderHook(() => useDeployTarget({ requestedProjectId: input.requestedProjectId }, dependencies), {
      wrapper: ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>
    });

    return { ...hook, store, useProjectsQuery };
  }
});
