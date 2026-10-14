import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import type { MockInstance } from "vitest";
import { describe, expect, it, vi } from "vitest";

import type { ProjectMember, ProjectRole } from "@src/types/project";
import {
  useCreateProjectMemberMutation,
  useDeleteProjectMemberMutation,
  useProjectMembersQuery,
  useProjectRolesOfUser,
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

  describe(useProjectRolesOfUser.name, () => {
    it("reads the user's role in each project from its grant list", async () => {
      const { result, listProjectMembers } = setup(() => useProjectRolesOfUser(["p1", "p2", "p3"], "u1", { enabled: true }), {
        grantsByProject: { p1: [grant("p1", "u1", "admin"), grant("p1", "u2", "viewer")], p2: [grant("p2", "u2", "member")], p3: [grant("p3", "u1", "viewer")] }
      });

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(listProjectMembers.mock.calls.map(([params]) => params)).toEqual([{ id: "p1" }, { id: "p2" }, { id: "p3" }]);
      expect(Object.fromEntries(result.current.rolesByProjectId)).toEqual({ p1: "admin", p3: "viewer" });
    });

    it("keeps the roles it read for a while instead of reading them again for every list that asks", async () => {
      const { result, renderAgain, listProjectMembers } = setup(() => useProjectRolesOfUser(["p1"], "u1", { enabled: true }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const second = renderAgain();

      expect(second.result.current.rolesByProjectId.get("p1")).toBe("viewer");
      expect(listProjectMembers).toHaveBeenCalledTimes(1);
    });

    it("reads nothing while it is disabled", () => {
      const { result, listProjectMembers } = setup(() => useProjectRolesOfUser(["p1"], "u1", { enabled: false }));

      expect(result.current).toEqual({ isLoading: false, rolesByProjectId: new Map() });
      expect(listProjectMembers).not.toHaveBeenCalled();
    });

    it("reads nothing before it knows who the user is", () => {
      const { listProjectMembers } = setup(() => useProjectRolesOfUser(["p1"], undefined, { enabled: true }));

      expect(listProjectMembers).not.toHaveBeenCalled();
    });

    it("finds no role in a project whose grants could not be read", async () => {
      const { result } = setup(() => useProjectRolesOfUser(["p1", "gone"], "u1", { enabled: true }), {
        grantsByProject: { p1: [grant("p1", "u1", "member")] }
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(Object.fromEntries(result.current.rolesByProjectId)).toEqual({ p1: "member" });
    });
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
      if (!grantsByProject[id]) throw new Error("Project not found");
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

    const renderAgain = () => setupQuery(hook, { services: { api: () => api, queryClient: () => queryClient } });

    return { ...rendered, renderAgain, invalidateQueries, listProjectMembers, createProjectMember, updateProjectMember, deleteProjectMember };
  }
});
