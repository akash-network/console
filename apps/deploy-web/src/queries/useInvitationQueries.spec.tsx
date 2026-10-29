import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationOutput } from "@src/types/organization";
import type { InvitationPreviewOutput, ReceivedInvitationOutput } from "@src/types/organizationMembership";
import {
  useAcceptInvitationMutation,
  useAcceptReceivedInvitationMutation,
  useDeclineReceivedInvitationMutation,
  useInvitationPreviewQuery,
  useReceivedInvitationsQuery
} from "./useInvitationQueries";
import { ORGANIZATIONS_QUERY_KEY, readCachedOrganizations } from "./useOrganizationQueries";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const TOKEN = "t".repeat(43);

describe("useInvitationQueries", () => {
  describe(useInvitationPreviewQuery.name, () => {
    it("previews the invitation behind the token and lets the page report refusals", async () => {
      const { result, previewInvitation, queryClient } = setup({ useHook: () => useInvitationPreviewQuery(TOKEN) });

      await waitFor(() => expect(result.current.data).toEqual(PREVIEW));
      expect(previewInvitation).toHaveBeenCalledWith({ data: { token: TOKEN } });
      const query = queryClient.getQueryCache().find({ queryKey: ["v1", "previewInvitation", { data: { token: TOKEN } }] });
      expect(query?.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });

    it.each([undefined, null])("waits while the token is %s", token => {
      const { result, previewInvitation } = setup({ useHook: () => useInvitationPreviewQuery(token) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(previewInvitation).not.toHaveBeenCalled();
    });
  });

  describe(useAcceptInvitationMutation.name, () => {
    it("adds the joined organization to the cached memberships and refreshes the preview", async () => {
      const { result, acceptInvitation, queryClient } = setup({ useHook: () => useAcceptInvitationMutation() });
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [PERSONAL] });

      await act(() => result.current.mutateAsync({ data: { token: TOKEN, confirmEmailMismatch: true } }));

      expect(acceptInvitation).toHaveBeenCalledWith({ data: { token: TOKEN, confirmEmailMismatch: true } });
      expect(readCachedOrganizations(queryClient)).toEqual([PERSONAL, JOINED]);
      expect(queryClient.getQueryState(PREVIEW_KEY)?.isInvalidated).toBe(true);
    });

    it("does not list an organization twice when the caller already belongs to it", async () => {
      const { result, queryClient } = setup({ useHook: () => useAcceptInvitationMutation() });
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [PERSONAL, JOINED] });

      await act(() => result.current.mutateAsync({ data: { token: TOKEN } }));

      expect(readCachedOrganizations(queryClient)).toEqual([PERSONAL, JOINED]);
    });

    it("refreshes the preview and leaves the memberships alone when the invitation is refused", async () => {
      const { result, acceptInvitation, queryClient } = setup({ useHook: () => useAcceptInvitationMutation() });
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [PERSONAL] });
      acceptInvitation.mockRejectedValue(new Error("expired"));

      await act(async () => {
        await expect(result.current.mutateAsync({ data: { token: TOKEN } })).rejects.toThrow("expired");
      });

      expect(readCachedOrganizations(queryClient)).toEqual([PERSONAL]);
      expect(queryClient.getQueryState(PREVIEW_KEY)?.isInvalidated).toBe(true);
      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });
  });

  describe(useReceivedInvitationsQuery.name, () => {
    it("lists the invitations sent to the user and lets the bell stay quiet about refusals", async () => {
      const { result, listReceivedInvitations, queryClient } = setup({ useHook: () => useReceivedInvitationsQuery({ enabled: true }) });

      await waitFor(() => expect(result.current.data).toEqual([RECEIVED]));
      expect(listReceivedInvitations).toHaveBeenCalled();
      const query = queryClient.getQueryCache().find({ queryKey: RECEIVED_KEY });
      expect(query?.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });

    it("waits while disabled", () => {
      const { result, listReceivedInvitations } = setup({ useHook: () => useReceivedInvitationsQuery({ enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(listReceivedInvitations).not.toHaveBeenCalled();
    });
  });

  describe(useAcceptReceivedInvitationMutation.name, () => {
    it("joins by id, adds the organization to the cached memberships and refreshes the received invitations", async () => {
      const { result, acceptReceivedInvitation, queryClient } = setup({ useHook: () => useAcceptReceivedInvitationMutation() });
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [PERSONAL] });

      await act(() => result.current.mutateAsync({ id: RECEIVED.id }));

      expect(acceptReceivedInvitation).toHaveBeenCalledWith({ id: RECEIVED.id });
      expect(readCachedOrganizations(queryClient)).toEqual([PERSONAL, JOINED]);
      expect(queryClient.getQueryState(RECEIVED_KEY)?.isInvalidated).toBe(true);
    });

    it("refreshes the received invitations and leaves the memberships alone when the invitation is refused", async () => {
      const { result, acceptReceivedInvitation, queryClient } = setup({ useHook: () => useAcceptReceivedInvitationMutation() });
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [PERSONAL] });
      acceptReceivedInvitation.mockRejectedValue(new Error("declined"));

      await act(async () => {
        await expect(result.current.mutateAsync({ id: RECEIVED.id })).rejects.toThrow("declined");
      });

      expect(readCachedOrganizations(queryClient)).toEqual([PERSONAL]);
      expect(queryClient.getQueryState(RECEIVED_KEY)?.isInvalidated).toBe(true);
      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });
  });

  describe(useDeclineReceivedInvitationMutation.name, () => {
    it("declines by id and refreshes the received invitations", async () => {
      const { result, declineReceivedInvitation, queryClient } = setup({ useHook: () => useDeclineReceivedInvitationMutation() });

      await act(() => result.current.mutateAsync({ id: RECEIVED.id }));

      expect(declineReceivedInvitation).toHaveBeenCalledWith({ id: RECEIVED.id });
      expect(queryClient.getQueryState(RECEIVED_KEY)?.isInvalidated).toBe(true);
    });

    it("refreshes the received invitations when the decline is refused, without reporting the refusal", async () => {
      const { result, declineReceivedInvitation, queryClient } = setup({ useHook: () => useDeclineReceivedInvitationMutation() });
      declineReceivedInvitation.mockRejectedValue(new Error("accepted"));

      await act(async () => {
        await expect(result.current.mutateAsync({ id: RECEIVED.id })).rejects.toThrow("accepted");
      });

      expect(queryClient.getQueryState(RECEIVED_KEY)?.isInvalidated).toBe(true);
      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });
  });

  function setup<T>(input: { useHook: () => T }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(PREVIEW_KEY, { data: PREVIEW });
    const previewInvitation = vi.fn().mockResolvedValue({ data: PREVIEW });
    queryClient.setQueryData(RECEIVED_KEY, { data: [RECEIVED] });
    const acceptInvitation = vi.fn().mockResolvedValue({ data: JOINED });
    const listReceivedInvitations = vi.fn().mockResolvedValue({ data: [RECEIVED] });
    const acceptReceivedInvitation = vi.fn().mockResolvedValue({ data: JOINED });
    const declineReceivedInvitation = vi.fn().mockResolvedValue(undefined);
    const api = createProxy({
      v1: { previewInvitation, acceptInvitation, listReceivedInvitations, acceptReceivedInvitation, declineReceivedInvitation }
    }) as unknown as ApiService;

    const { result } = setupQuery(input.useHook, { services: { api: () => api, queryClient: () => queryClient } });

    return { result, queryClient, previewInvitation, acceptInvitation, listReceivedInvitations, acceptReceivedInvitation, declineReceivedInvitation };
  }
});

const PREVIEW_KEY = ["v1", "previewInvitation", { data: { token: "cached" } }];

const RECEIVED_KEY = ["v1", "listReceivedInvitations"];

const RECEIVED: ReceivedInvitationOutput = {
  id: "2f4b5a3e-8f1c-4c55-9a1e-3c1d2b4e5f60",
  organizationId: "org-2",
  organizationName: "Acme Corp",
  inviterName: "alice",
  role: "member",
  createdAt: "2026-10-28T00:00:00Z",
  expiresAt: "2026-11-04T00:00:00Z"
};

const PREVIEW: InvitationPreviewOutput = {
  organizationName: "Acme Corp",
  inviterName: "alice",
  role: "member",
  email: "bob@acme.io",
  status: "pending",
  expiresAt: "2026-10-16T00:00:00Z"
};

const PERSONAL: OrganizationOutput = {
  id: "org-1",
  name: "bob",
  slug: "personal-bob",
  type: "personal",
  role: "owner",
  isActive: true,
  hasPaymentMethod: true,
  createdAt: "2026-01-01T00:00:00Z"
};

const JOINED: OrganizationOutput = {
  id: "org-2",
  name: "Acme Corp",
  slug: "acme-corp",
  type: "team",
  role: "member",
  isActive: false,
  hasPaymentMethod: null,
  createdAt: "2026-02-01T00:00:00Z"
};
