import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/context/OrganizationProvider/OrganizationProvider";
import { OrganizationProvider } from "@src/context/OrganizationProvider/OrganizationProvider";
import { shouldReportError } from "@src/services/query-error-policy/query-error-policy";
import { StaleOrganizationRecovery } from "@src/services/stale-organization-recovery/stale-organization-recovery";
import { TabOrganization } from "@src/services/tab-organization/tab-organization";
import type { OrganizationOutput } from "@src/types/organization";
import type { RenderAppHookOptions } from "../../tests/unit/query-client";
import {
  useCommunityTemplates,
  useCreateTemplateMutation,
  useCreateTemplateVersionMutation,
  useCurrentTemplatePublisher,
  useDeleteMarketplaceTemplateMutation,
  useMarketplaceTemplate,
  useMyTemplates,
  useOrganizationTemplates,
  usePublishTemplateMutation,
  useReportTemplateMutation,
  useTemplatePublisher,
  useTemplatePublishReadiness,
  useTemplateVersion,
  useTemplateVersions,
  useUpdateTemplatePublisherMutation,
  useUpdateTemplateSettingsMutation
} from "./useUserTemplateQueries";

import { act, renderHook, waitFor } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const LIST_KEY = ["v1", "listUserTemplates"];
const TEMPLATE_KEY = ["v1", "getUserTemplate", { id: "tpl-1" }];
const VERSIONS_KEY = ["v1", "listUserTemplateVersions", { id: "tpl-1" }];
const PUBLISHER_KEY = ["v1", "getTemplatePublisher", { handle: "lambda-garage" }];
const OWN_PUBLISHER_KEY = ["v1", "getCurrentTemplatePublisher"];
const READINESS_KEY = ["v1", "getUserTemplatePublishReadiness", { id: "tpl-1" }];
const READINESS = {
  termsVersion: "2026-11",
  requirements: [{ key: "email_verified", met: true }],
  checks: [{ key: "sdl_valid", status: "passed", issues: [] }],
  ranAt: "2026-11-18T18:00:00.000Z",
  canPublish: true
};

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

  describe(useTemplatePublishReadiness.name, () => {
    it("unwraps the readiness of the template", async () => {
      const { result, getUserTemplatePublishReadiness } = setup({ useHook: () => useTemplatePublishReadiness("tpl-1", { enabled: true }) });

      await waitFor(() => expect(result.current.data).toEqual(READINESS));
      expect(getUserTemplatePublishReadiness).toHaveBeenCalledWith({ id: "tpl-1" });
    });

    it("runs no checks until they are asked for", () => {
      const { result, getUserTemplatePublishReadiness } = setup({ useHook: () => useTemplatePublishReadiness("tpl-1", { enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getUserTemplatePublishReadiness).not.toHaveBeenCalled();
    });

    it("never reuses a result, so every opening shows a fresh run", async () => {
      const { result, queryClient } = setup({ useHook: () => useTemplatePublishReadiness("tpl-1", { enabled: true }) });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const [query] = queryClient.getQueryCache().findAll({ queryKey: READINESS_KEY });

      expect(result.current.isStale).toBe(true);
      expect(query.options).toEqual(expect.objectContaining({ gcTime: 0, retry: false, refetchOnWindowFocus: false }));
    });

    it("leaves a refusal to the dialog, without a retry", async () => {
      const { result, queryClient, getUserTemplatePublishReadiness } = setup({
        useHook: () => useTemplatePublishReadiness("tpl-1", { enabled: true }),
        readinessError: new Error("refused")
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(getUserTemplatePublishReadiness).toHaveBeenCalledTimes(1);
      const [query] = queryClient.getQueryCache().findAll({ queryKey: READINESS_KEY });
      expect(query.meta?.skipErrorReporting).toEqual(expect.any(Function));
    });
  });

  describe(usePublishTemplateMutation.name, () => {
    it("writes the published template into its own query and refreshes its versions and the lists", async () => {
      const { result, publishUserTemplate, queryClient } = setup({ useHook: () => usePublishTemplateMutation() });
      const published = { ...TEMPLATE, visibility: "public", isListed: true };
      publishUserTemplate.mockResolvedValue({ data: published });
      queryClient.setQueryData(TEMPLATE_KEY, { data: TEMPLATE });
      queryClient.setQueryData(VERSIONS_KEY, { data: [VERSION] });
      queryClient.setQueryData(LIST_KEY, { data: [LIST_ITEM] });
      queryClient.setQueryData(["v1", "listUserTemplateVersions", { id: "tpl-2" }], { data: [VERSION] });

      await act(() => result.current.mutateAsync({ id: "tpl-1", data: { acceptedTermsVersion: "2026-11" } }));

      expect(publishUserTemplate).toHaveBeenCalledWith({ id: "tpl-1", data: { acceptedTermsVersion: "2026-11" } });
      expect(queryClient.getQueryData(TEMPLATE_KEY)).toEqual({ data: published });
      expect(queryClient.getQueryState(VERSIONS_KEY)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(["v1", "listUserTemplateVersions", { id: "tpl-2" }])?.isInvalidated).toBe(false);
    });

    it("leaves a refusal to the dialog and changes nothing", async () => {
      const { result, publishUserTemplate, queryClient } = setup({ useHook: () => usePublishTemplateMutation() });
      publishUserTemplate.mockRejectedValue(new Error("refused"));
      queryClient.setQueryData(TEMPLATE_KEY, { data: TEMPLATE });
      queryClient.setQueryData(LIST_KEY, { data: [LIST_ITEM] });

      await act(async () => {
        await expect(result.current.mutateAsync({ id: "tpl-1", data: { acceptedTermsVersion: "2026-11" } })).rejects.toThrow("refused");
      });

      expect(queryClient.getQueryData(TEMPLATE_KEY)).toEqual({ data: TEMPLATE });
      expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);
      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation.meta?.skipErrorReporting).toEqual(expect.any(Function));
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

  describe(useCommunityTemplates.name, () => {
    it("unwraps the community gallery and asks once while the answer is fresh", async () => {
      const { result, listCommunityTemplates, queryClient } = setup({ useHook: () => useCommunityTemplates({ enabled: true }) });

      await waitFor(() => expect(result.current.data).toEqual(COMMUNITY_GALLERY));
      expect(listCommunityTemplates).toHaveBeenCalledWith(undefined);
      expect(
        queryClient
          .getQueryCache()
          .find({ queryKey: ["v1", "listCommunityTemplates"] })
          ?.isStale()
      ).toBe(false);
    });

    it("stays idle while the marketplace is off", () => {
      const { result, listCommunityTemplates } = setup({ useHook: () => useCommunityTemplates({ enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(listCommunityTemplates).not.toHaveBeenCalled();
    });

    it("does not report a refusal, such as a gallery the API has switched off, and reports a server error", async () => {
      const { result, queryClient } = setup({ useHook: () => useCommunityTemplates({ enabled: true }) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = queryClient.getQueryCache().find({ queryKey: ["v1", "listCommunityTemplates"] });
      expect(shouldReportError(new ApiError(404, null, "404"), query?.meta)).toBe(false);
      expect(shouldReportError(new ApiError(500, null, "500"), query?.meta)).toBe(true);
    });
  });

  describe(useTemplatePublisher.name, () => {
    it("unwraps the publisher page and asks once while the answer is fresh", async () => {
      const { result, getTemplatePublisher, queryClient } = setup({ useHook: () => useTemplatePublisher("lambda-garage") });

      await waitFor(() => expect(result.current.data).toEqual(PUBLISHER_PAGE));
      expect(getTemplatePublisher).toHaveBeenCalledExactlyOnceWith({ handle: "lambda-garage" });
      expect(queryClient.getQueryCache().find({ queryKey: PUBLISHER_KEY })?.isStale()).toBe(false);
    });

    it("does not report an unknown or suspended publisher, and reports a server error", async () => {
      const { result, queryClient } = setup({ useHook: () => useTemplatePublisher("lambda-garage") });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = queryClient.getQueryCache().find({ queryKey: PUBLISHER_KEY });
      expect(shouldReportError(new ApiError(404, null, "404"), query?.meta)).toBe(false);
      expect(shouldReportError(new ApiError(500, null, "500"), query?.meta)).toBe(true);
    });
  });

  describe(useCurrentTemplatePublisher.name, () => {
    it("unwraps the active organization's publisher profile", async () => {
      const { result, getCurrentTemplatePublisher } = setup({ useHook: () => useCurrentTemplatePublisher({ enabled: true }) });

      await waitFor(() => expect(result.current.data).toEqual(OWN_PUBLISHER));
      expect(getCurrentTemplatePublisher).toHaveBeenCalledExactlyOnceWith(undefined);
    });

    it("asks again for the organization switched to", async () => {
      const { result, getCurrentTemplatePublisher, switchOrganization, queryClient } = setup({
        useHook: () => useCurrentTemplatePublisher({ enabled: true })
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      switchOrganization("org-2");

      await waitFor(() => expect(getCurrentTemplatePublisher).toHaveBeenCalledTimes(2));
      expect(queryClient.getQueryCache().find({ queryKey: [...OWN_PUBLISHER_KEY, "org-2"] })).toBeDefined();
    });

    it("does not load when the caller turns it off", () => {
      const { result, getCurrentTemplatePublisher } = setup({ useHook: () => useCurrentTemplatePublisher({ enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getCurrentTemplatePublisher).not.toHaveBeenCalled();
    });

    it("does not load without an active organization", () => {
      const { result, getCurrentTemplatePublisher } = setup({ useHook: () => useCurrentTemplatePublisher({ enabled: true }), hasOrganizations: false });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getCurrentTemplatePublisher).not.toHaveBeenCalled();
    });

    it("does not report an organization that has not published yet, and reports a server error", async () => {
      const { result, queryClient } = setup({ useHook: () => useCurrentTemplatePublisher({ enabled: true }) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = queryClient.getQueryCache().find({ queryKey: [...OWN_PUBLISHER_KEY, "org-1"] });
      expect(shouldReportError(new ApiError(404, null, "404"), query?.meta)).toBe(false);
      expect(shouldReportError(new ApiError(500, null, "500"), query?.meta)).toBe(true);
    });
  });

  describe(useUpdateTemplatePublisherMutation.name, () => {
    it("keeps the saved profile as the organization's own and refreshes its public page", async () => {
      const saved = { ...OWN_PUBLISHER, bio: "A new bio." };
      const { result, updateCurrentTemplatePublisher, getTemplatePublisher, getCurrentTemplatePublisher } = setup({
        useHook: () => ({
          page: useTemplatePublisher("lambda-garage"),
          otherPage: useTemplatePublisher("northwind-labs"),
          own: useCurrentTemplatePublisher({ enabled: true }),
          update: useUpdateTemplatePublisherMutation()
        })
      });
      await waitFor(() => expect(result.current.own.isSuccess && result.current.page.isSuccess && result.current.otherPage.isSuccess).toBe(true));
      updateCurrentTemplatePublisher.mockResolvedValueOnce({ data: saved });

      await act(() => result.current.update.mutateAsync({ data: { bio: "A new bio.", links: [] } }));

      expect(updateCurrentTemplatePublisher).toHaveBeenCalledExactlyOnceWith({ data: { bio: "A new bio.", links: [] } });
      await waitFor(() => expect(result.current.own.data).toEqual(saved));
      expect(getCurrentTemplatePublisher).toHaveBeenCalledOnce();
      await waitFor(() =>
        expect(getTemplatePublisher.mock.calls).toEqual([[{ handle: "lambda-garage" }], [{ handle: "northwind-labs" }], [{ handle: "lambda-garage" }]])
      );
    });

    it("keeps the saved profile when a read that started before the save finishes after it", async () => {
      const saved = { ...OWN_PUBLISHER, bio: "A new bio." };
      const { result, updateCurrentTemplatePublisher, getCurrentTemplatePublisher } = setup({
        useHook: () => ({ own: useCurrentTemplatePublisher({ enabled: true }), update: useUpdateTemplatePublisherMutation() })
      });
      await waitFor(() => expect(result.current.own.isSuccess).toBe(true));
      const olderRead = Promise.withResolvers<{ data: typeof OWN_PUBLISHER }>();
      getCurrentTemplatePublisher.mockReturnValueOnce(olderRead.promise);
      act(() => void result.current.own.refetch());
      updateCurrentTemplatePublisher.mockResolvedValueOnce({ data: saved });

      await act(() => result.current.update.mutateAsync({ data: { bio: "A new bio.", links: [] } }));
      await act(async () => olderRead.resolve({ data: OWN_PUBLISHER }));

      await waitFor(() => expect(result.current.own.data).toEqual(saved));
      expect(getCurrentTemplatePublisher).toHaveBeenCalledTimes(2);
    });

    it("does not report a refusal, such as a member who may not edit, and reports a server error", async () => {
      const { result, queryClient } = setup({ useHook: () => useUpdateTemplatePublisherMutation() });

      await act(() => result.current.mutateAsync({ data: { bio: null } }));

      const meta = queryClient.getMutationCache().getAll()[0].options.meta;
      expect(shouldReportError(new ApiError(403, null, "403"), meta)).toBe(false);
      expect(shouldReportError(new ApiError(400, null, "400"), meta)).toBe(false);
      expect(shouldReportError(new ApiError(500, null, "500"), meta)).toBe(true);
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
          update: useUpdateTemplateSettingsMutation(),
          remove: useDeleteMarketplaceTemplateMutation()
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
      const { result, updateUserTemplate, queryClient } = setup({ useHook: () => useUpdateTemplateSettingsMutation() });
      const renamed = { ...TEMPLATE, title: "Renamed" };
      updateUserTemplate.mockResolvedValue({ data: renamed });

      await act(() => result.current.mutateAsync({ id: "tpl-1", data: { title: "Renamed" } }));

      expect(queryClient.getQueryData(TEMPLATE_KEY)).toEqual({ data: renamed });
    });

    it("refreshes the template and its versions after a new version is saved", async () => {
      const { result, createUserTemplateVersion, queryClient } = setup({ useHook: () => useCreateTemplateVersionMutation() });
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
          const { mutateAsync } = useCreateTemplateVersionMutation();
          return () => mutateAsync({ id: "tpl-1", data: NEW_VERSION });
        }
      ],
      [
        "updateUserTemplate",
        function useRefusedUpdate(): () => Promise<unknown> {
          const { mutateAsync } = useUpdateTemplateSettingsMutation();
          return () => mutateAsync({ id: "tpl-1", data: { title: "Renamed" } });
        }
      ],
      [
        "deleteUserTemplate",
        function useRefusedDelete(): () => Promise<unknown> {
          const { mutateAsync } = useDeleteMarketplaceTemplateMutation();
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

  describe("template reads", () => {
    it.each([
      [
        "getUserTemplate",
        function useTemplateRead() {
          return useMarketplaceTemplate("tpl-1").isSuccess;
        }
      ],
      [
        "listUserTemplateVersions",
        function useVersionsRead() {
          return useTemplateVersions("tpl-1", { enabled: true }).isSuccess;
        }
      ],
      [
        "getUserTemplateVersion",
        function useVersionRead() {
          return useTemplateVersion("tpl-1", 2).isSuccess;
        }
      ]
    ] as const)("keeps a refused %s out of error reporting and reports a server fault", async (operationId, useRead) => {
      const { result, queryClient } = setup({ useHook: useRead });

      await waitFor(() => expect(result.current).toBe(true));

      const query = queryClient.getQueryCache().find({ queryKey: ["v1", operationId], exact: false });
      expect(shouldReportError(new ApiError(410, { code: "template_removed" }, "410"), query?.meta)).toBe(false);
      expect(shouldReportError(new ApiError(404, null, "404"), query?.meta)).toBe(false);
      expect(shouldReportError(new ApiError(500, null, "500"), query?.meta)).toBe(true);
    });
  });

  describe(useReportTemplateMutation.name, () => {
    it("files the report with its reason and details", async () => {
      const { result, createUserTemplateReport } = setup({ useHook: () => useReportTemplateMutation() });

      await act(async () => {
        await result.current.mutateAsync({ id: "tpl-1", data: { reason: "malware_or_miner", details: "Starts xmrig" } });
      });

      expect(createUserTemplateReport).toHaveBeenCalledWith({ id: "tpl-1", data: { reason: "malware_or_miner", details: "Starts xmrig" } });
    });

    it.each([
      [409, "template_already_reported"],
      [409, "template_not_reportable"],
      [403, "template_report_own_organization"],
      [410, "template_removed"],
      [429, "template_rate_limited"],
      [400, "validation_error"]
    ])("keeps a %i %s out of error reporting", async (status, code) => {
      const { result, queryClient, createUserTemplateReport } = setup({ useHook: () => useReportTemplateMutation() });
      const refusal = new ApiError(status, { code, message: "Refused" }, String(status));
      createUserTemplateReport.mockRejectedValue(refusal);

      await act(async () => {
        await expect(result.current.mutateAsync({ id: "tpl-1", data: { reason: "spam" } })).rejects.toBe(refusal);
      });

      const [mutation] = queryClient.getMutationCache().getAll();
      expect(shouldReportError(refusal, mutation.meta)).toBe(false);
      expect(shouldReportError(new ApiError(500, null, "500"), mutation.meta)).toBe(true);
    });
  });

  function setup<T>(input: { useHook: () => T; hasOrganizations?: boolean; listedTemplates?: (typeof LIST_ITEM)[][]; readinessError?: Error }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getUserTemplate = vi.fn().mockResolvedValue({ data: TEMPLATE });
    const listUserTemplateVersions = vi.fn().mockResolvedValue({ data: [VERSION] });
    const getUserTemplateVersion = vi.fn().mockResolvedValue({ data: VERSION });
    const listUserTemplates = vi.fn().mockResolvedValue({ data: [LIST_ITEM] });
    const listCommunityTemplates = vi.fn().mockResolvedValue({ data: COMMUNITY_GALLERY });
    input.listedTemplates?.forEach(templates => listUserTemplates.mockResolvedValueOnce({ data: templates }));
    const createUserTemplate = vi.fn().mockResolvedValue({ data: TEMPLATE });
    const createUserTemplateVersion = vi.fn().mockResolvedValue({ data: VERSION });
    const updateUserTemplate = vi.fn().mockResolvedValue({ data: TEMPLATE });
    const deleteUserTemplate = vi.fn().mockResolvedValue(undefined);
    const getUserTemplatePublishReadiness = input.readinessError
      ? vi.fn().mockRejectedValue(input.readinessError)
      : vi.fn().mockResolvedValue({ data: READINESS });
    const publishUserTemplate = vi.fn().mockResolvedValue({ data: TEMPLATE });
    const getTemplatePublisher = vi.fn().mockResolvedValue({ data: PUBLISHER_PAGE });
    const getCurrentTemplatePublisher = vi.fn().mockResolvedValue({ data: OWN_PUBLISHER });
    const updateCurrentTemplatePublisher = vi.fn().mockResolvedValue({ data: OWN_PUBLISHER });
    const createUserTemplateReport = vi.fn().mockResolvedValue({ data: { id: "report-1", reason: "spam", createdAt: "2026-11-19T10:00:00.000Z" } });
    const api = createProxy({
      v1: {
        getUserTemplate,
        listUserTemplateVersions,
        getUserTemplateVersion,
        listUserTemplates,
        listCommunityTemplates,
        createUserTemplate,
        createUserTemplateVersion,
        updateUserTemplate,
        deleteUserTemplate,
        getUserTemplatePublishReadiness,
        publishUserTemplate,
        createUserTemplateReport,
        getTemplatePublisher,
        getCurrentTemplatePublisher,
        updateCurrentTemplatePublisher
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
      listCommunityTemplates,
      createUserTemplate,
      createUserTemplateVersion,
      updateUserTemplate,
      deleteUserTemplate,
      getUserTemplatePublishReadiness,
      publishUserTemplate,
      createUserTemplateReport,
      getTemplatePublisher,
      getCurrentTemplatePublisher,
      updateCurrentTemplatePublisher
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

const COMMUNITY_GALLERY = { templates: [{ id: "tpl-1", title: "Llama server" }], officialUsage: { llama: { deploys: 3, stillUpAfter24h: null, forks: 0 } } };
const OWN_PUBLISHER = { name: "Lambda Garage", handle: "lambda-garage", bio: null, links: [], canEdit: true };
const PUBLISHER_PAGE = { name: "Lambda Garage", handle: "lambda-garage", bio: null, links: [], templates: [] };
const LIST_ITEM = { id: "tpl-1", title: "Llama server", usage: USAGE };
