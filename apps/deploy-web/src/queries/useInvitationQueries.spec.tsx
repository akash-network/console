import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationOutput } from "@src/types/organization";
import type { InvitationPreviewOutput } from "@src/types/organizationMembership";
import { useAcceptInvitationMutation, useInvitationPreviewQuery } from "./useInvitationQueries";
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

  function setup<T>(input: { useHook: () => T }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(PREVIEW_KEY, { data: PREVIEW });
    const previewInvitation = vi.fn().mockResolvedValue({ data: PREVIEW });
    const acceptInvitation = vi.fn().mockResolvedValue({ data: JOINED });
    const api = createProxy({ v1: { previewInvitation, acceptInvitation } }) as unknown as ApiService;

    const { result } = setupQuery(input.useHook, { services: { api: () => api, queryClient: () => queryClient } });

    return { result, queryClient, previewInvitation, acceptInvitation };
  }
});

const PREVIEW_KEY = ["v1", "previewInvitation", { data: { token: "cached" } }];

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
  createdAt: "2026-01-01T00:00:00Z"
};

const JOINED: OrganizationOutput = {
  id: "org-2",
  name: "Acme Corp",
  slug: "acme-corp",
  type: "team",
  role: "member",
  isActive: false,
  createdAt: "2026-02-01T00:00:00Z"
};
