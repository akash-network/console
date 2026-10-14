import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import type { ProjectMember } from "@src/types/project";
import { useProjectMembersQuery } from "./useProjectMembersQuery";

import { waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useProjectMembersQuery.name, () => {
  it("lists the members granted the project", async () => {
    const { result, listProjectMembers } = setup({});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listProjectMembers).toHaveBeenCalledWith({ id: "p1" });
    expect(result.current.data?.map(member => member.username)).toEqual(["lena"]);
  });

  it("asks for nothing while it is disabled", () => {
    const { result, listProjectMembers } = setup({ enabled: false });

    expect(result.current.fetchStatus).toBe("idle");
    expect(listProjectMembers).not.toHaveBeenCalled();
  });

  function setup(input: { enabled?: boolean }) {
    const member: ProjectMember = {
      id: "g1",
      projectId: "p1",
      userId: "u1",
      username: "lena",
      email: null,
      role: "viewer",
      createdAt: "2026-01-01T00:00:00.000Z"
    };
    const listProjectMembers = vi.fn(async (_params: unknown) => ({ data: [member] }));
    const api = createProxy({ v1: { listProjectMembers } }) as unknown as ApiService;
    const hook = setupQuery(() => useProjectMembersQuery("p1", input.enabled === undefined ? undefined : { enabled: input.enabled }), {
      services: { api: () => api }
    });

    return { ...hook, listProjectMembers };
  }
});
