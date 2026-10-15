import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "@src/types/project";
import { ORGANIZATION_ACTIVITIES_QUERY_KEY } from "./useOrganizationActivitiesQuery";
import {
  isProjectNameTakenError,
  PROJECTS_QUERY_KEY,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useProjectsQuery,
  useUpdateProjectMutation
} from "./useProjectsQuery";

import { act, waitFor } from "@testing-library/react";
import { buildProject } from "@tests/seeders/project";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useProjectsQuery.name, () => {
  it("lists the active organization's projects", async () => {
    const { result, listProjects } = setup();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map(project => project.name)).toEqual(["default", "storefront"]);
    expect(listProjects).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing while it is disabled", () => {
    const { result, listProjects } = setup({ enabled: false });

    expect(result.current.fetchStatus).toBe("idle");
    expect(listProjects).not.toHaveBeenCalled();
  });

  it("shares its key with the one invalidations use", () => {
    const { api } = setup();

    expect(api.v1.listProjects.getKey()).toEqual([...PROJECTS_QUERY_KEY]);
  });

  function setup(input: { enabled?: boolean } = {}) {
    const listProjects = vi.fn(async () => ({ data: [project("default"), project("storefront")] }));
    const api = createProxy({ v1: { listProjects } }) as unknown as ApiService;
    const hook = setupQuery(() => useProjectsQuery(input.enabled === undefined ? undefined : { enabled: input.enabled }), { services: { api: () => api } });

    return { ...hook, listProjects, api };
  }
});

describe(useCreateProjectMutation.name, () => {
  it("creates the project and refreshes the projects and the activity feed", async () => {
    const createProject = vi.fn(async () => ({ data: project("checkout-api") }));
    const api = createProxy({ v1: { createProject } }) as unknown as ApiService;
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = setupQuery(() => useCreateProjectMutation(), { services: { api: () => api, queryClient: () => queryClient } });

    await act(() => result.current.mutateAsync({ data: { name: "checkout-api" } }));

    expect(createProject).toHaveBeenCalledWith({ data: { name: "checkout-api" } });
    expect(invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([PROJECTS_QUERY_KEY, ORGANIZATION_ACTIVITIES_QUERY_KEY]);
  });
});

describe(useUpdateProjectMutation.name, () => {
  it("renames the project and refreshes the projects", async () => {
    const updateProject = vi.fn(async () => ({ data: project("shop") }));
    const { result, invalidateQueries } = setupMutation({ updateProject }, useUpdateProjectMutation);

    await act(() => result.current.mutateAsync({ id: "p1", data: { name: "shop" } }));

    expect(updateProject).toHaveBeenCalledWith({ id: "p1", data: { name: "shop" } });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: PROJECTS_QUERY_KEY });
  });
});

describe(useDeleteProjectMutation.name, () => {
  it("deletes the project and refreshes the projects", async () => {
    const deleteProject = vi.fn(async () => undefined);
    const { result, invalidateQueries } = setupMutation({ deleteProject }, useDeleteProjectMutation);

    await act(() => result.current.mutateAsync({ id: "p1" }));

    expect(deleteProject).toHaveBeenCalledWith({ id: "p1" });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: PROJECTS_QUERY_KEY });
  });
});

function setupMutation<T>(operations: Record<string, unknown>, useMutation: () => T) {
  const api = createProxy({ v1: operations }) as unknown as ApiService;
  const queryClient = new QueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const hook = setupQuery(() => useMutation(), { services: { api: () => api, queryClient: () => queryClient } });

  return { ...hook, invalidateQueries };
}

describe(isProjectNameTakenError.name, () => {
  it("recognizes the conflict the api answers for a name in use", () => {
    expect(isProjectNameTakenError(new ApiError(409, { message: "taken", code: "project_name_taken" }, "conflict"))).toBe(true);
  });

  it("does not mistake another conflict or another status for it", () => {
    expect(isProjectNameTakenError(new ApiError(409, { message: "other", code: "project_is_default" }, "conflict"))).toBe(false);
    expect(isProjectNameTakenError(new ApiError(400, { message: "taken", code: "project_name_taken" }, "bad request"))).toBe(false);
    expect(isProjectNameTakenError(new Error("project_name_taken"))).toBe(false);
  });
});

function project(name: string): Project {
  return buildProject({ id: name, name, isDefault: name === "default", createdAt: "2026-01-01T00:00:00.000Z", createdBy: null });
}
