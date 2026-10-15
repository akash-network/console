import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import type { MockInstance } from "vitest";
import { describe, expect, it, vi } from "vitest";

import type { ProjectMember, ProjectRole } from "@src/types/project";
import {
  useCreateProjectMemberMutation,
  useDeleteProjectMemberMutation,
  useProjectMembersQuery,
  useUpdateProjectMemberMutation
} from "./useProjectMembersQuery";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useProjectMembersQuery.name, () => {
  it("lists the members granted the project", async () => {
    const { result, listProjectMembers } = setup(() => useProjectMembersQuery("p1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listProjectMembers).toHaveBeenCalledWith({ id: "p1" });
    expect(result.current.data?.map(member => member.username)).toEqual(["lena"]);
  });

  it("asks for nothing while it is disabled", () => {
    const { result, listProjectMembers } = setup(() => useProjectMembersQuery("p1", { enabled: false }));

    expect(result.current.fetchStatus).toBe("idle");
    expect(listProjectMembers).not.toHaveBeenCalled();
  });

  describe("granting, changing and revoking access", () => {
    it("grants access, then refreshes every grant list and the activity feed", async () => {
      const { result, createProjectMember, invalidateQueries } = setup(() => useCreateProjectMemberMutation());

      await act(() => result.current.mutateAsync({ data: { projectId: "p1", userId: "u2", role: "viewer" } }));

      expect(createProjectMember).toHaveBeenCalledWith({ data: { projectId: "p1", userId: "u2", role: "viewer" } });
      expectAccessQueriesInvalidated(invalidateQueries);
    });

    it("changes a grant's role, then refreshes every grant list and the activity feed", async () => {
      const { result, updateProjectMember, invalidateQueries } = setup(() => useUpdateProjectMemberMutation());

      await act(() => result.current.mutateAsync({ id: "g1", data: { role: "admin" } }));

      expect(updateProjectMember).toHaveBeenCalledWith({ id: "g1", data: { role: "admin" } });
      expectAccessQueriesInvalidated(invalidateQueries);
    });

    it("revokes a grant, then refreshes every grant list and the activity feed at once", async () => {
      const { result, deleteProjectMember, invalidateQueries } = setup(() => useDeleteProjectMemberMutation());

      await act(() => result.current.mutateAsync({ id: "g1" }));

      expect(deleteProjectMember).toHaveBeenCalledWith({ id: "g1" });
      expectAccessQueriesInvalidated(invalidateQueries);
    });

    it("leaves the cached lists alone when the API refuses", async () => {
      const { result, invalidateQueries } = setup(() => useDeleteProjectMemberMutation(), { refuseWrites: true });

      await act(() => result.current.mutateAsync({ id: "g1" }).catch(() => undefined));

      expect(invalidateQueries).not.toHaveBeenCalled();
    });
  });

  function expectAccessQueriesInvalidated(invalidateQueries: MockInstance<QueryClient["invalidateQueries"]>) {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listProjectMembers"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listOrganizationActivities"] });
  }

  function grant(projectId: string, userId: string, role: ProjectRole): ProjectMember {
    return { id: `${projectId}-${userId}`, projectId, userId, username: userId, email: null, role, createdAt: "2026-01-01T00:00:00.000Z" };
  }

  function setup<T>(hook: () => T, input: { grantsByProject?: Record<string, ProjectMember[]>; refuseWrites?: boolean } = {}) {
    const grantsByProject = input.grantsByProject ?? { p1: [{ ...grant("p1", "u1", "viewer"), username: "lena" }] };
    const listProjectMembers = vi.fn(async ({ id }: { id: string }) => {
      if (!grantsByProject[id]) throw new ApiError(404, undefined, "GET /v1/projects/{id}/members → 404");
      return { data: grantsByProject[id] };
    });
    const write = () => vi.fn(async (_params: unknown) => (input.refuseWrites ? Promise.reject(new Error("refused")) : { data: grant("p1", "u2", "viewer") }));
    const createProjectMember = write();
    const updateProjectMember = write();
    const deleteProjectMember = write();
    const api = createProxy({ v1: { listProjectMembers, createProjectMember, updateProjectMember, deleteProjectMember } }) as unknown as ApiService;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const rendered = setupQuery(hook, { services: { api: () => api, queryClient: () => queryClient } });

    return {
      ...rendered,
      invalidateQueries,
      listProjectMembers,
      createProjectMember,
      updateProjectMember,
      deleteProjectMember
    };
  }
});
