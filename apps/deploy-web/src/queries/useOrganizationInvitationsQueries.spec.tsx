import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationInvitationOutput } from "@src/types/organizationMembership";
import {
  useCreateOrganizationInvitationLinkMutation,
  useDeleteOrganizationInvitationMutation,
  useOrganizationInvitationsQuery,
  useResendOrganizationInvitationMutation
} from "./useOrganizationInvitationsQueries";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const INVITATIONS_KEY = ["v1", "listOrganizationInvitations"];

const INVITE_URL = "https://console.akash.network/invitations#token=abc";

describe("useOrganizationInvitationsQueries", () => {
  describe(useOrganizationInvitationsQuery.name, () => {
    it("unwraps the pending invitations from the response envelope", async () => {
      const { result, listOrganizationInvitations } = setup({ useHook: () => useOrganizationInvitationsQuery({ enabled: true }) });

      await waitFor(() => expect(listOrganizationInvitations).toHaveBeenCalledOnce());
      await waitFor(() => expect(result.current.data).toEqual([INVITATION]));
    });

    it("does not load for someone who cannot manage invitations", () => {
      const { result, listOrganizationInvitations } = setup({ useHook: () => useOrganizationInvitationsQuery({ enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(listOrganizationInvitations).not.toHaveBeenCalled();
    });
  });

  describe(useResendOrganizationInvitationMutation.name, () => {
    it("resends the invitation and refetches the pending list", async () => {
      const { result, resendOrganizationInvitation, queryClient } = setup({ useHook: () => useResendOrganizationInvitationMutation() });

      await act(() => result.current.mutateAsync({ id: "invitation-1" }));

      expect(resendOrganizationInvitation).toHaveBeenCalledWith({ id: "invitation-1" });
      expect(queryClient.getQueryState(INVITATIONS_KEY)?.isInvalidated).toBe(true);
    });
  });

  describe(useCreateOrganizationInvitationLinkMutation.name, () => {
    it("returns a fresh invitation link and refetches the pending list for its renewed expiry", async () => {
      const { result, createOrganizationInvitationLink, queryClient } = setup({ useHook: () => useCreateOrganizationInvitationLinkMutation() });

      const response = await act(() => result.current.mutateAsync({ id: "invitation-1" }));

      expect(response).toEqual({ data: { url: INVITE_URL } });
      expect(createOrganizationInvitationLink).toHaveBeenCalledWith({ id: "invitation-1" });
      expect(queryClient.getQueryState(INVITATIONS_KEY)?.isInvalidated).toBe(true);
    });
  });

  describe(useDeleteOrganizationInvitationMutation.name, () => {
    it("revokes the invitation and refetches the pending list", async () => {
      const { result, deleteOrganizationInvitation, queryClient } = setup({ useHook: () => useDeleteOrganizationInvitationMutation() });

      await act(() => result.current.mutateAsync({ id: "invitation-1" }));

      expect(deleteOrganizationInvitation).toHaveBeenCalledWith({ id: "invitation-1" });
      expect(queryClient.getQueryState(INVITATIONS_KEY)?.isInvalidated).toBe(true);
    });
  });

  describe("when the API refuses a write", () => {
    it.each([
      [
        "resendOrganizationInvitation",
        function useRefusedResend(): () => Promise<unknown> {
          const { mutateAsync } = useResendOrganizationInvitationMutation();
          return () => mutateAsync({ id: "invitation-1" });
        }
      ],
      [
        "createOrganizationInvitationLink",
        function useRefusedLink(): () => Promise<unknown> {
          const { mutateAsync } = useCreateOrganizationInvitationLinkMutation();
          return () => mutateAsync({ id: "invitation-1" });
        }
      ],
      [
        "deleteOrganizationInvitation",
        function useRefusedRevoke(): () => Promise<unknown> {
          const { mutateAsync } = useDeleteOrganizationInvitationMutation();
          return () => mutateAsync({ id: "invitation-1" });
        }
      ]
    ] as const)("leaves the pending list alone and %s refusals to the page", async (operationId, useRefusedWrite) => {
      const { result, queryClient, ...operations } = setup({ useHook: useRefusedWrite });
      operations[operationId].mockRejectedValue(new Error("refused"));

      await act(async () => {
        await expect(result.current()).rejects.toThrow("refused");
      });

      expect(queryClient.getQueryState(INVITATIONS_KEY)?.isInvalidated).toBe(false);
      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });
  });

  function setup<T>(input: { useHook: () => T }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(INVITATIONS_KEY, { data: [INVITATION] });
    const listOrganizationInvitations = vi.fn().mockResolvedValue({ data: [INVITATION] });
    const resendOrganizationInvitation = vi.fn().mockResolvedValue({ data: INVITATION });
    const createOrganizationInvitationLink = vi.fn().mockResolvedValue({ data: { url: INVITE_URL } });
    const deleteOrganizationInvitation = vi.fn().mockResolvedValue(undefined);
    const api = createProxy({
      v1: { listOrganizationInvitations, resendOrganizationInvitation, createOrganizationInvitationLink, deleteOrganizationInvitation }
    }) as unknown as ApiService;

    const { result } = setupQuery(input.useHook, { services: { api: () => api, queryClient: () => queryClient } });

    return { result, queryClient, listOrganizationInvitations, resendOrganizationInvitation, createOrganizationInvitationLink, deleteOrganizationInvitation };
  }
});

const INVITATION: OrganizationInvitationOutput = {
  id: "invitation-1",
  email: "carol@acme.io",
  role: "member",
  projectGrants: [],
  invitedBy: { id: "user-1", username: "alice" },
  createdAt: "2026-10-01T00:00:00Z",
  expiresAt: "2026-10-08T00:00:00Z"
};
