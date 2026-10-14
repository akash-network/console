import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useCanManageDeployment";
import { useCanManageDeployment } from "./useCanManageDeployment";

import { act, renderHook } from "@testing-library/react";

describe(useCanManageDeployment.name, () => {
  it("judges the deployment by the project it is filed under", () => {
    const { result, canManageDeployments, useDeploymentLocationQuery } = setup({ projectId: "storefront", manageableProjectIds: ["storefront"] });

    expect(result.current).toMatchObject({ canManage: true, isLoading: false, isError: false });
    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: true });
    expect(canManageDeployments).toHaveBeenCalledWith("storefront");
  });

  it("refuses a deployment filed under a project the caller only views", () => {
    const { result } = setup({ projectId: "marketing", manageableProjectIds: ["storefront"] });

    expect(result.current).toMatchObject({ canManage: false, isLoading: false, isError: false });
  });

  it("judges a deployment whose project is not known yet as filed nowhere", () => {
    const { canManageDeployments } = setup({ projectId: undefined, manageableProjectIds: [] });

    expect(canManageDeployments).toHaveBeenCalledWith(undefined);
  });

  it("is still deciding while the caller's access loads", () => {
    const { result } = setup({ projectId: "storefront", manageableProjectIds: [], isLoadingAccess: true });

    expect(result.current).toMatchObject({ canManage: false, isLoading: true, isError: false });
  });

  it("is still deciding while the deployment's project loads", () => {
    const { result } = setup({ projectId: undefined, manageableProjectIds: [], isLoadingLocation: true });

    expect(result.current.isLoading).toBe(true);
  });

  it("waits for no location while projects are off", () => {
    const { result, useDeploymentLocationQuery } = setup({ isEnabled: false, projectId: undefined, manageableProjectIds: [], isLoadingLocation: true });

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: false });
    expect(result.current.isLoading).toBe(false);
  });

  it("has decided as soon as the caller may manage the deployment", () => {
    const { result } = setup({ projectId: undefined, manageableProjectIds: [], managesEveryProject: true, isLoadingAccess: true, isLoadingLocation: true });

    expect(result.current).toMatchObject({ canManage: true, isLoading: false, isError: false });
  });

  it("says the caller's access could not be read, and reads it again on retry", () => {
    const { result, retryAccess, refetchLocation } = setup({ projectId: "storefront", manageableProjectIds: [], isAccessError: true });

    expect(result.current).toMatchObject({ canManage: false, isLoading: false, isError: true });

    act(() => result.current.retry());

    expect(retryAccess).toHaveBeenCalledTimes(1);
    expect(refetchLocation).not.toHaveBeenCalled();
  });

  it("says the deployment's project could not be read, and reads it again on retry", () => {
    const { result, retryAccess, refetchLocation } = setup({ projectId: undefined, manageableProjectIds: ["storefront"], isLocationError: true });

    expect(result.current).toMatchObject({ canManage: false, isLoading: false, isError: true });

    act(() => result.current.retry());

    expect(refetchLocation).toHaveBeenCalledTimes(1);
    expect(retryAccess).not.toHaveBeenCalled();
  });

  it("reads no failed location as an error while projects are off", () => {
    const { result } = setup({ isEnabled: false, projectId: undefined, manageableProjectIds: [], isLocationError: true });

    expect(result.current.isError).toBe(false);
  });

  it("reports no error once the caller may manage the deployment anyway", () => {
    const { result } = setup({ projectId: undefined, manageableProjectIds: [], managesEveryProject: true, isAccessError: true, isLocationError: true });

    expect(result.current).toMatchObject({ canManage: true, isError: false });
  });

  it("reports no error when the organization role forbids managing anyway", () => {
    const { result } = setup({ projectId: undefined, manageableProjectIds: [], canChangeDeployments: false, isAccessError: true, isLocationError: true });

    expect(result.current.isError).toBe(false);
  });

  it.each([true, false])("lets nobody manage when the organization role forbids it, while the rest is loading: %s", isLoading => {
    const { result } = setup({
      projectId: "storefront",
      manageableProjectIds: ["storefront"],
      canChangeDeployments: false,
      isLoadingAccess: isLoading,
      isLoadingLocation: isLoading
    });

    expect(result.current).toMatchObject({ canManage: false, isLoading: false, isError: false });
  });

  function setup(input: {
    canChangeDeployments?: boolean;
    projectId: string | undefined;
    manageableProjectIds: string[];
    isEnabled?: boolean;
    isLoadingAccess?: boolean;
    isLoadingLocation?: boolean;
    isAccessError?: boolean;
    isLocationError?: boolean;
    managesEveryProject?: boolean;
  }) {
    const retryAccess = vi.fn();
    const refetchLocation = vi.fn();
    const canManageDeployments = vi.fn(
      (projectId: string | null | undefined) => !!input.managesEveryProject || (!!projectId && input.manageableProjectIds.includes(projectId))
    );
    const useDeploymentLocationQuery = vi.fn<typeof DEPENDENCIES.useDeploymentLocationQuery>(() =>
      input.isLoadingLocation
        ? mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({ data: undefined, isLoading: true, isError: false, refetch: refetchLocation })
        : input.isLocationError
          ? mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({ data: undefined, isLoading: false, isError: true, refetch: refetchLocation })
          : mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({
              data: input.projectId ? { organizationId: "org-1", organizationSlug: "acme-corp", projectId: input.projectId } : null,
              isLoading: false,
              isError: false,
              refetch: refetchLocation
            })
    );
    const dependencies: typeof DEPENDENCIES = {
      useProjectsUi: () => ({
        isEnabled: input.isEnabled ?? true,
        canManageProjects: false,
        canChangeDeployments: input.canChangeDeployments ?? true,
        organizationName: "Acme Corp"
      }),
      useProjectAccess: () =>
        mock<ReturnType<typeof DEPENDENCIES.useProjectAccess>>({
          canManageDeployments,
          isLoading: input.isLoadingAccess ?? false,
          isError: input.isAccessError ?? false,
          retry: retryAccess
        }),
      useDeploymentLocationQuery
    };

    const hook = renderHook(() => useCanManageDeployment("100", dependencies));

    return { ...hook, canManageDeployments, useDeploymentLocationQuery, retryAccess, refetchLocation };
  }
});
