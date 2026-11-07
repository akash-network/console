import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/context/OrganizationProvider/OrganizationProvider";
import { OrganizationProvider } from "@src/context/OrganizationProvider/OrganizationProvider";
import { StaleOrganizationRecovery } from "@src/services/stale-organization-recovery/stale-organization-recovery";
import { TabOrganization } from "@src/services/tab-organization/tab-organization";
import type { OrganizationOutput } from "@src/types/organization";
import type { RenderAppHookOptions } from "../../tests/unit/query-client";
import {
  useCreateTemplateMutation,
  useCreateTemplateVersionMutation,
  useDeleteMarketplaceTemplateMutation,
  useMarketplaceTemplate,
  useMyTemplates,
  useOrganizationTemplates,
  useTemplateVersion,
  useTemplateVersions,
  useUpdateTemplateSettingsMutation
} from "./useUserTemplateQueries";

import { act, renderHook, waitFor } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const LIST_KEY = ["v1", "listUserTemplates"];
const TEMPLATE_KEY = ["v1", "getUserTemplate", { id: "tpl-1" }];
const VERSIONS_KEY = ["v1", "listUserTemplateVersions", { id: "tpl-1" }];

describe("useUserTemplateQueries", () => {
  describe(useMarketplaceTemplate.name, () => {
    it("unwraps the template from the response envelope", async () => {
      const { result, getUserTemplate } = setup({ useHook: () => useMarketplaceTemplate("tpl-1") });

      await waitFor(() => expect(result.current.data).toEqual(TEMPLATE));
      expect(getUserTemplate).toHaveBeenCalledWith({ id: "tpl-1" });
    });

    it("does not load before the template is known", () => {
      const { result, getUserTemplate } = setup({ useHook: () => useMarketplaceTemplate(undefined) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getUserTemplate).not.toHaveBeenCalled();
    });
  });

  describe(useTemplateVersions.name, () => {
    it("unwraps the version list", async () => {
      const { result, listUserTemplateVersions } = setup({ useHook: () => useTemplateVersions("tpl-1", { enabled: true }) });

      await waitFor(() => expect(result.current.data).toEqual([VERSION]));
      expect(listUserTemplateVersions).toHaveBeenCalledWith({ id: "tpl-1" });
    });

    it.each([
      ["the caller turns it off", "tpl-1", false],
      ["the template is not known", undefined, true]
    ])("does not load when %s", (_, id, enabled) => {
      const { result, listUserTemplateVersions } = setup({ useHook: () => useTemplateVersions(id, { enabled }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(listUserTemplateVersions).not.toHaveBeenCalled();
    });
  });

  describe(useTemplateVersion.name, () => {
    it("loads one version of a template", async () => {
      const { result, getUserTemplateVersion } = setup({ useHook: () => useTemplateVersion("tpl-1", 2) });

      await waitFor(() => expect(result.current.data).toEqual(VERSION));
      expect(getUserTemplateVersion).toHaveBeenCalledWith({ id: "tpl-1", version: 2 });
    });

    it.each([
      ["the template is not known", undefined, 2],
      ["the version is not known", "tpl-1", undefined]
    ])("does not load when %s", (_, id, version) => {
      const { result, getUserTemplateVersion } = setup({ useHook: () => useTemplateVersion(id, version) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getUserTemplateVersion).not.toHaveBeenCalled();
    });
  });

  describe(useMyTemplates.name, () => {
    it("lists the templates without a filter", async () => {
      const { result, listUserTemplates } = setup({ useHook: () => useMyTemplates() });

      await waitFor(() => expect(result.current.data).toEqual([LIST_ITEM]));
      expect(listUserTemplates).toHaveBeenCalledWith(undefined);
    });
  });

  describe(useOrganizationTemplates.name, () => {
    it("asks only for organization-wide templates in the gallery list", async () => {
      const { result, listUserTemplates } = setup({ useHook: () => useOrganizationTemplates({ enabled: true }) });

      await waitFor(() => expect(result.current.data).toEqual([LIST_ITEM]));
      expect(listUserTemplates).toHaveBeenCalledOnce();
      expect(listUserTemplates).toHaveBeenCalledWith({ visibility: "organization" });
    });

    it("keys the organization list by the active organization", async () => {
      const { result, listUserTemplates, switchOrganization, queryClient } = setup({
        useHook: () => useOrganizationTemplates({ enabled: true }),
        listedTemplates: [[{ ...LIST_ITEM, id: "from-org-1" }], [{ ...LIST_ITEM, id: "from-org-2" }]]
      });

      await waitFor(() => expect(result.current.data?.map(template => template.id)).toEqual(["from-org-1"]));
      switchOrganization("org-2");
      await waitFor(() => expect(result.current.data?.map(template => template.id)).toEqual(["from-org-2"]));

      expect(listUserTemplates).toHaveBeenCalledTimes(2);
      const keys = queryClient
        .getQueryCache()
        .findAll({ queryKey: LIST_KEY })
        .map(query => query.queryKey);
      expect(keys).toEqual(
        expect.arrayContaining([
          [...LIST_KEY, { visibility: "organization" }, "org-1"],
          [...LIST_KEY, { visibility: "organization" }, "org-2"]
        ])
      );
    });

    it("does not load when the caller turns it off", () => {
      const { result, listUserTemplates } = setup({ useHook: () => useOrganizationTemplates({ enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(listUserTemplates).not.toHaveBeenCalled();
    });

    it("does not load without an active organization", () => {
      const { result, listUserTemplates } = setup({ useHook: () => useOrganizationTemplates({ enabled: true }), hasOrganizations: false });

      expect(result.current.fetchStatus).toBe("idle");
      expect(listUserTemplates).not.toHaveBeenCalled();
    });
  });

  describe("template writes", () => {
    it("refreshes the lists after a template is created, updated or deleted", async () => {
      const { result, createUserTemplate, updateUserTemplate, deleteUserTemplate, queryClient } = setup({
        useHook: () => ({
          create: useCreateTemplateMutation(),
          update: useUpdateTemplateSettingsMutation("tpl-1"),
          remove: useDeleteMarketplaceTemplateMutation("tpl-1")
        })
      });
      const isListInvalidated = () => queryClient.getQueryState(LIST_KEY)?.isInvalidated;
      const refreshList = () => queryClient.setQueryData(LIST_KEY, { data: [LIST_ITEM] });

      refreshList();
      await act(() => result.current.create.mutateAsync({ data: NEW_TEMPLATE }));
      expect(createUserTemplate).toHaveBeenCalledWith({ data: NEW_TEMPLATE });
      expect(isListInvalidated()).toBe(true);

      refreshList();
      expect(isListInvalidated()).toBe(false);
      await act(() => result.current.update.mutateAsync({ id: "tpl-1", data: { title: "Renamed" } }));
      expect(updateUserTemplate).toHaveBeenCalledWith({ id: "tpl-1", data: { title: "Renamed" } });
      expect(isListInvalidated()).toBe(true);

      refreshList();
      await act(() => result.current.remove.mutateAsync({ id: "tpl-1" }));
      expect(deleteUserTemplate).toHaveBeenCalledWith({ id: "tpl-1" });
      expect(isListInvalidated()).toBe(true);
    });

    it("refreshes every organization's list, whatever filter it was read with", async () => {
      const { result, queryClient } = setup({ useHook: () => useCreateTemplateMutation() });
      const organizationListKey = [...LIST_KEY, { visibility: "organization" }, "org-1"];
      queryClient.setQueryData(organizationListKey, { data: [LIST_ITEM] });

      await act(() => result.current.mutateAsync({ data: NEW_TEMPLATE }));

      expect(queryClient.getQueryState(organizationListKey)?.isInvalidated).toBe(true);
    });

    it("writes the updated template into its own query", async () => {
      const { result, updateUserTemplate, queryClient } = setup({ useHook: () => useUpdateTemplateSettingsMutation("tpl-1") });
      const renamed = { ...TEMPLATE, title: "Renamed" };
      updateUserTemplate.mockResolvedValue({ data: renamed });

      await act(() => result.current.mutateAsync({ id: "tpl-1", data: { title: "Renamed" } }));

      expect(queryClient.getQueryData(TEMPLATE_KEY)).toEqual({ data: renamed });
    });

    it("refreshes the template and its versions after a new version is saved", async () => {
      const { result, createUserTemplateVersion, queryClient } = setup({ useHook: () => useCreateTemplateVersionMutation("tpl-1") });
      queryClient.setQueryData(TEMPLATE_KEY, { data: TEMPLATE });
      queryClient.setQueryData(VERSIONS_KEY, { data: [VERSION] });
      queryClient.setQueryData(LIST_KEY, { data: [LIST_ITEM] });
      queryClient.setQueryData(["v1", "getUserTemplate", { id: "tpl-2" }], { data: TEMPLATE });

      await act(() => result.current.mutateAsync({ id: "tpl-1", data: NEW_VERSION }));

      expect(createUserTemplateVersion).toHaveBeenCalledWith({ id: "tpl-1", data: NEW_VERSION });
      expect(queryClient.getQueryState(TEMPLATE_KEY)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(VERSIONS_KEY)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(["v1", "getUserTemplate", { id: "tpl-2" }])?.isInvalidated).toBe(false);
    });

    it("forgets a deleted template", async () => {
      const { result, queryClient } = setup({ useHook: () => useDeleteMarketplaceTemplateMutation("tpl-1") });
      queryClient.setQueryData(TEMPLATE_KEY, { data: TEMPLATE });

      await act(() => result.current.mutateAsync({ id: "tpl-1" }));

      expect(queryClient.getQueryData(TEMPLATE_KEY)).toBeUndefined();
    });

    it.each([
      [
        "createUserTemplate",
        function useRefusedCreate(): () => Promise<unknown> {
          const { mutateAsync } = useCreateTemplateMutation();
          return () => mutateAsync({ data: NEW_TEMPLATE });
        }
      ],
      [
        "createUserTemplateVersion",
        function useRefusedVersion(): () => Promise<unknown> {
          const { mutateAsync } = useCreateTemplateVersionMutation("tpl-1");
          return () => mutateAsync({ id: "tpl-1", data: NEW_VERSION });
        }
      ],
      [
        "updateUserTemplate",
        function useRefusedUpdate(): () => Promise<unknown> {
          const { mutateAsync } = useUpdateTemplateSettingsMutation("tpl-1");
          return () => mutateAsync({ id: "tpl-1", data: { title: "Renamed" } });
        }
      ],
      [
        "deleteUserTemplate",
        function useRefusedDelete(): () => Promise<unknown> {
          const { mutateAsync } = useDeleteMarketplaceTemplateMutation("tpl-1");
          return () => mutateAsync({ id: "tpl-1" });
        }
      ]
    ] as const)("leaves %s refusals to the caller and refreshes nothing", async (operationId, useRefusedWrite) => {
      const { result, queryClient, ...operations } = setup({ useHook: useRefusedWrite });
      operations[operationId].mockRejectedValue(new Error("refused"));
      queryClient.setQueryData(LIST_KEY, { data: [LIST_ITEM] });

      await act(async () => {
        await expect(result.current()).rejects.toThrow("refused");
      });

      expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);
      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });
  });

  function setup<T>(input: { useHook: () => T; hasOrganizations?: boolean; listedTemplates?: (typeof LIST_ITEM)[][] }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getUserTemplate = vi.fn().mockResolvedValue({ data: TEMPLATE });
    const listUserTemplateVersions = vi.fn().mockResolvedValue({ data: [VERSION] });
    const getUserTemplateVersion = vi.fn().mockResolvedValue({ data: VERSION });
    const listUserTemplates = vi.fn().mockResolvedValue({ data: [LIST_ITEM] });
    input.listedTemplates?.forEach(templates => listUserTemplates.mockResolvedValueOnce({ data: templates }));
    const createUserTemplate = vi.fn().mockResolvedValue({ data: TEMPLATE });
    const createUserTemplateVersion = vi.fn().mockResolvedValue({ data: VERSION });
    const updateUserTemplate = vi.fn().mockResolvedValue({ data: TEMPLATE });
    const deleteUserTemplate = vi.fn().mockResolvedValue(undefined);
    const api = createProxy({
      v1: {
        getUserTemplate,
        listUserTemplateVersions,
        getUserTemplateVersion,
        listUserTemplates,
        createUserTemplate,
        createUserTemplateVersion,
        updateUserTemplate,
        deleteUserTemplate
      }
    }) as unknown as ApiService;

    const membershipsQuery = (organizations: OrganizationOutput[]) =>
      mock<ReturnType<typeof DEPENDENCIES.useOrganizationsQuery>>({ data: organizations, isLoading: false, isError: false });
    let memberships = membershipsQuery(input.hasOrganizations === false ? [] : buildOrganizations("org-1"));
    const router = mock<NextRouter>({ asPath: "/templates", isReady: true, replace: vi.fn().mockResolvedValue(true) });
    router.query = {};
    const tabOrganization = new TabOrganization();
    const user = mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: { id: "user-1", userId: "auth0|user-1" } });
    const store = mock<ReturnType<typeof DEPENDENCIES.useStore>>();
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>();
    const organizationProviderDependencies: typeof DEPENDENCIES = {
      useFlag: () => true,
      useFeatureFlagsReady: () => true,
      useUser: () => user,
      useOrganizationsQuery: () => memberships,
      useRouter: () => router,
      useQueryClient: () => queryClient,
      useStore: () => store,
      useSnackbar: () => snackbar,
      BootLoading: () => null
    };

    const { result, rerender } = renderHook(input.useHook, {
      wrapper: ({ children }) => (
        <TestContainerProvider
          services={{
            api: () => api,
            queryClient: () => queryClient,
            staleOrganizationRecovery: () => new StaleOrganizationRecovery(tabOrganization),
            tabOrganization: () => tabOrganization
          }}
        >
          <OrganizationProvider dependencies={organizationProviderDependencies}>{children}</OrganizationProvider>
        </TestContainerProvider>
      )
    });

    return {
      result,
      queryClient,
      switchOrganization: (organizationId: string) => {
        memberships = membershipsQuery(buildOrganizations(organizationId));
        rerender();
      },
      getUserTemplate,
      listUserTemplateVersions,
      getUserTemplateVersion,
      listUserTemplates,
      createUserTemplate,
      createUserTemplateVersion,
      updateUserTemplate,
      deleteUserTemplate
    };
  }
});

function buildOrganizations(activeId: string): OrganizationOutput[] {
  return [
    { id: "org-1", name: "alice", slug: "personal-0123456789ab", type: "personal", role: "owner", createdAt: "2026-01-01T00:00:00Z" },
    { id: "org-2", name: "Acme Corp", slug: "acme-corp", type: "team", role: "admin", createdAt: "2026-02-01T00:00:00Z" }
  ].map(organization => ({ ...organization, isActive: organization.id === activeId }) as OrganizationOutput);
}

const NEW_TEMPLATE = { title: "My template", sdl: "services: {}", askedValues: [] };

const NEW_VERSION = { baseVersion: 1, sdl: "services: {}", askedValues: [] };

const USAGE = { deploys: 4, lastDeployedAt: null };

const TEMPLATE = { id: "tpl-1", title: "Llama server", usage: { ...USAGE, stillUpAfter24h: null } };

const VERSION = { version: 2, deploys: 1 };

const LIST_ITEM = { id: "tpl-1", title: "Llama server", usage: USAGE };
