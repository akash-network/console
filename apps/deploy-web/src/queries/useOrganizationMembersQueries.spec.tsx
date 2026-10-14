import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import {
  useDeleteOrganizationMemberMutation,
  useOrganizationMembersQuery,
  useTransferOrganizationOwnershipMutation,
  useUpdateOrganizationMemberMutation
} from "./useOrganizationMembersQueries";
import { ORGANIZATIONS_QUERY_KEY } from "./useOrganizationQueries";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const MEMBERS_KEY = ["v1", "listOrganizationMembers"];

describe("useOrganizationMembersQueries", () => {
  describe(useOrganizationMembersQuery.name, () => {
    it("unwraps the members from the response envelope", async () => {
      const { result, listOrganizationMembers } = setup({ useHook: () => useOrganizationMembersQuery({ enabled: true }) });

      await waitFor(() => expect(result.current.data).toEqual([MEMBER]));
      expect(listOrganizationMembers).toHaveBeenCalledOnce();
    });

    it("does not load while disabled", () => {
      const { result, listOrganizationMembers } = setup({ useHook: () => useOrganizationMembersQuery({ enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(listOrganizationMembers).not.toHaveBeenCalled();
    });
  });

  describe(useUpdateOrganizationMemberMutation.name, () => {
    it("changes the role and refetches the roster", async () => {
      const { result, updateOrganizationMember, queryClient } = setup({ useHook: () => useUpdateOrganizationMemberMutation() });

      await act(() => result.current.mutateAsync({ id: "member-1", data: { role: "admin" } }));

      expect(updateOrganizationMember).toHaveBeenCalledWith({ id: "member-1", data: { role: "admin" } });
      expect(queryClient.getQueryState(MEMBERS_KEY)?.isInvalidated).toBe(true);
    });
  });

  describe(useDeleteOrganizationMemberMutation.name, () => {
    it("removes the member and refetches the roster", async () => {
      const { result, deleteOrganizationMember, queryClient } = setup({ useHook: () => useDeleteOrganizationMemberMutation() });

      await act(() => result.current.mutateAsync({ id: "member-1" }));

      expect(deleteOrganizationMember).toHaveBeenCalledWith({ id: "member-1" });
      expect(queryClient.getQueryState(MEMBERS_KEY)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(ORGANIZATIONS_QUERY_KEY)?.isInvalidated).toBe(false);
    });
  });

  describe(useTransferOrganizationOwnershipMutation.name, () => {
    it("transfers ownership and refetches the roster and the caller's memberships", async () => {
      const { result, transferOrganizationOwnership, queryClient } = setup({ useHook: () => useTransferOrganizationOwnershipMutation() });

      await act(() => result.current.mutateAsync({ id: "member-1" }));

      expect(transferOrganizationOwnership).toHaveBeenCalledWith({ id: "member-1" });
      expect(queryClient.getQueryState(MEMBERS_KEY)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(ORGANIZATIONS_QUERY_KEY)?.isInvalidated).toBe(true);
    });
  });

  describe("when the API refuses a write", () => {
    it.each([
      [
        "updateOrganizationMember",
        function useRefusedUpdate(): () => Promise<unknown> {
          const { mutateAsync } = useUpdateOrganizationMemberMutation();
          return () => mutateAsync({ id: "member-1", data: { role: "admin" } });
        }
      ],
      [
        "deleteOrganizationMember",
        function useRefusedDelete(): () => Promise<unknown> {
          const { mutateAsync } = useDeleteOrganizationMemberMutation();
          return () => mutateAsync({ id: "member-1" });
        }
      ],
      [
        "transferOrganizationOwnership",
        function useRefusedTransfer(): () => Promise<unknown> {
          const { mutateAsync } = useTransferOrganizationOwnershipMutation();
          return () => mutateAsync({ id: "member-1" });
        }
      ]
    ] as const)("keeps the roster cached and leaves %s refusals to the page", async (operationId, useRefusedWrite) => {
      const { result, queryClient, ...operations } = setup({ useHook: useRefusedWrite });
      operations[operationId].mockRejectedValue(new Error("refused"));

      await act(async () => {
        await expect(result.current()).rejects.toThrow("refused");
      });

      expect(queryClient.getQueryState(MEMBERS_KEY)?.isInvalidated).toBe(false);
      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });
  });

  function setup<T>(input: { useHook: () => T }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(MEMBERS_KEY, { data: [MEMBER] });
    queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [] });
    const listOrganizationMembers = vi.fn().mockResolvedValue({ data: [MEMBER] });
    const updateOrganizationMember = vi.fn().mockResolvedValue({ data: { ...MEMBER, role: "admin" } });
    const deleteOrganizationMember = vi.fn().mockResolvedValue(undefined);
    const transferOrganizationOwnership = vi.fn().mockResolvedValue({ data: { ...MEMBER, role: "owner" } });
    const api = createProxy({
      v1: { listOrganizationMembers, updateOrganizationMember, deleteOrganizationMember, transferOrganizationOwnership }
    }) as unknown as ApiService;

    const { result } = setupQuery(input.useHook, { services: { api: () => api, queryClient: () => queryClient } });

    return { result, queryClient, listOrganizationMembers, updateOrganizationMember, deleteOrganizationMember, transferOrganizationOwnership };
  }
});

const MEMBER: OrganizationMemberOutput = {
  id: "member-1",
  userId: "user-2",
  username: "bob",
  email: "bob@acme.io",
  role: "member",
  createdAt: "2026-01-01T00:00:00Z"
};
