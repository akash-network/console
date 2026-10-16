import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationOutput } from "@src/types/organization";
import {
  addCachedOrganization,
  ORGANIZATIONS_QUERY_KEY,
  readCachedOrganizations,
  replaceCachedOrganization,
  useCreateOrganizationInvitationsMutation,
  useCreateOrganizationMutation,
  useOrganizationsQuery,
  useRenameOrganizationMutation
} from "./useOrganizationQueries";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe("useOrganizationQueries", () => {
  describe(useOrganizationsQuery.name, () => {
    it("unwraps the memberships from the response envelope and caches them under the shared key", async () => {
      const { personal, team } = buildOrganizations();
      const { result, listOrganizations, queryClient } = setup({ useHook: () => useOrganizationsQuery({ enabled: true }), organizations: [personal, team] });

      await waitFor(() => expect(result.current.data).toEqual([personal, team]));
      expect(listOrganizations).toHaveBeenCalledOnce();
      expect(readCachedOrganizations(queryClient)).toEqual([personal, team]);
    });

    it("does not load while disabled", () => {
      const { result, listOrganizations } = setup({ useHook: () => useOrganizationsQuery({ enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(listOrganizations).not.toHaveBeenCalled();
    });
  });

  describe(useCreateOrganizationMutation.name, () => {
    it("creates the organization and adds it to the cached memberships", async () => {
      const { personal, team } = buildOrganizations();
      const { result, createOrganization, queryClient } = setup({ useHook: () => useCreateOrganizationMutation(), created: team });
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [personal] });

      await act(() => result.current.mutateAsync({ data: { name: team.name } }));

      expect(createOrganization).toHaveBeenCalledWith({ data: { name: team.name } });
      expect(readCachedOrganizations(queryClient)).toEqual([personal, team]);
    });
  });

  describe(useCreateOrganizationInvitationsMutation.name, () => {
    it("invites into the active organization and refreshes its pending invitations", async () => {
      const { result, createOrganizationInvitations, queryClient } = setup({ useHook: () => useCreateOrganizationInvitationsMutation() });
      queryClient.setQueryData(["v1", "listOrganizationInvitations"], { data: [] });

      await act(() => result.current.mutateAsync({ data: { emails: ["bob@harborline.io"], role: "member" } }));

      expect(createOrganizationInvitations).toHaveBeenCalledWith({ data: { emails: ["bob@harborline.io"], role: "member" } });
      expect(queryClient.getQueryState(["v1", "listOrganizationInvitations"])?.isInvalidated).toBe(true);
    });
  });

  describe(useRenameOrganizationMutation.name, () => {
    it("renames the organization and swaps the renamed one into the cached memberships", async () => {
      const { personal, team } = buildOrganizations();
      const renamed = { ...team, name: "Globex Labs" };
      const { result, updateOrganization, queryClient } = setup({ useHook: () => useRenameOrganizationMutation(), renamed });
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [personal, team] });

      await act(() => result.current.mutateAsync({ id: team.id, data: { name: renamed.name } }));

      expect(updateOrganization).toHaveBeenCalledWith({ id: team.id, data: { name: renamed.name } });
      expect(readCachedOrganizations(queryClient)).toEqual([personal, renamed]);
    });
  });

  describe(replaceCachedOrganization.name, () => {
    it("leaves the memberships uncached when none were loaded", () => {
      const queryClient = new QueryClient();
      const { team } = buildOrganizations();

      replaceCachedOrganization(queryClient, team);

      expect(readCachedOrganizations(queryClient)).toBeUndefined();
    });
  });

  describe(addCachedOrganization.name, () => {
    it("appends the created organization to the cached memberships", () => {
      const queryClient = new QueryClient();
      const { personal, team } = buildOrganizations();
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [personal] });

      addCachedOrganization(queryClient, team);

      expect(readCachedOrganizations(queryClient)).toEqual([personal, team]);
    });

    it("starts the memberships with the created organization when none are cached", () => {
      const queryClient = new QueryClient();
      const { team } = buildOrganizations();

      addCachedOrganization(queryClient, team);

      expect(readCachedOrganizations(queryClient)).toEqual([team]);
    });

    it("reads nothing before the memberships are cached", () => {
      expect(readCachedOrganizations(new QueryClient())).toBeUndefined();
    });
  });

  function buildOrganizations() {
    const personal: OrganizationOutput = {
      id: "org-1",
      name: "alice",
      slug: "personal-0123456789ab",
      type: "personal",
      role: "owner",
      isActive: true,
      hasPaymentMethod: true,
      createdAt: "2026-01-01T00:00:00Z"
    };
    const team: OrganizationOutput = {
      id: "org-9",
      name: "Globex",
      slug: "globex",
      type: "team",
      role: "owner",
      isActive: false,
      hasPaymentMethod: null,
      createdAt: "2026-04-01T00:00:00Z"
    };

    return { personal, team };
  }

  function setup<T>(input: { useHook: () => T; organizations?: OrganizationOutput[]; created?: OrganizationOutput; renamed?: OrganizationOutput }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listOrganizations = vi.fn().mockResolvedValue({ data: input.organizations ?? [] });
    const createOrganization = vi.fn().mockResolvedValue({ data: input.created });
    const updateOrganization = vi.fn().mockResolvedValue({ data: input.renamed });
    const createOrganizationInvitations = vi.fn().mockResolvedValue({ data: [] });
    const listOrganizationInvitations = vi.fn().mockResolvedValue({ data: [] });
    const api = createProxy({
      v1: { listOrganizations, createOrganization, updateOrganization, createOrganizationInvitations, listOrganizationInvitations }
    }) as unknown as ApiService;

    const { result } = setupQuery(input.useHook, { services: { api: () => api, queryClient: () => queryClient } });

    return { result, queryClient, listOrganizations, createOrganization, updateOrganization, createOrganizationInvitations };
  }
});
