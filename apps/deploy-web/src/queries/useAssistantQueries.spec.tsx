import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  useAssistantPrivacyQuery,
  useDeleteAssistantConversationsMutation,
  useEndAssistantConversationMutation,
  useRecordAssistantActionResultMutation,
  useStartAssistantConversationMutation,
  useUpdateAssistantConsentMutation
} from "./useAssistantQueries";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const PRIVACY = {
  consent: { copyVersion: "v1", processingAcceptedAt: "2026-11-04T00:00:00.000Z", reviewOptIn: false, updatedAt: "2026-11-04T00:00:00.000Z" },
  storedConversationCount: 2
};

describe("useAssistantQueries", () => {
  describe(useAssistantPrivacyQuery.name, () => {
    it("unwraps the user's assistant privacy", async () => {
      const { result } = setup({ useHook: () => useAssistantPrivacyQuery({ enabled: true }) });

      await waitFor(() => expect(result.current.data).toEqual(PRIVACY));
    });

    it("does not load while disabled", () => {
      const { result, getAssistantConsent } = setup({ useHook: () => useAssistantPrivacyQuery({ enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getAssistantConsent).not.toHaveBeenCalled();
    });
  });

  describe(useUpdateAssistantConsentMutation.name, () => {
    it("saves the consent and caches the privacy the api answers with", async () => {
      const { result, updateAssistantConsent, queryClient, api } = setup({ useHook: () => useUpdateAssistantConsentMutation() });
      const body = { data: { copyVersion: "v1", reviewOptIn: true } };

      await act(() => result.current.mutateAsync(body));

      expect(updateAssistantConsent).toHaveBeenCalledWith(body);
      expect(queryClient.getQueryData(api.v1.getAssistantConsent.getKey())).toEqual({ data: { ...PRIVACY, storedConversationCount: 5 } });
    });
  });

  describe(useDeleteAssistantConversationsMutation.name, () => {
    it("deletes the conversations and reloads the privacy", async () => {
      const { result, deleteAssistantConversations, queryClient, api } = setup({ useHook: () => useDeleteAssistantConversationsMutation() });
      queryClient.setQueryData(api.v1.getAssistantConsent.getKey(), { data: PRIVACY });

      await act(() => result.current.mutateAsync());

      expect(deleteAssistantConversations).toHaveBeenCalled();
      expect(queryClient.getQueryState(api.v1.getAssistantConsent.getKey())?.isInvalidated).toBe(true);
    });
  });

  describe("conversation mutations", () => {
    it("start, end and record results of a conversation", async () => {
      const start = setup({ useHook: () => useStartAssistantConversationMutation() });
      await act(() => start.result.current.mutateAsync({ data: { copyVersion: "v1" } }));
      expect(start.createAssistantConversation).toHaveBeenCalledWith({ data: { copyVersion: "v1" } });

      const end = setup({ useHook: () => useEndAssistantConversationMutation() });
      await act(() => end.result.current.mutateAsync({ id: "c-1", data: { resolvedByUser: true } }));
      expect(end.endAssistantConversation).toHaveBeenCalledWith({ id: "c-1", data: { resolvedByUser: true } });

      const record = setup({ useHook: () => useRecordAssistantActionResultMutation() });
      const body = { id: "c-1", data: { proposalId: "p-1", actionType: "buy_credits" as const, decision: "cancelled" as const } };
      await act(() => record.result.current.mutateAsync(body));
      expect(record.createAssistantActionResult).toHaveBeenCalledWith(body);
    });
  });

  function setup<T>(input: { useHook: () => T }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getAssistantConsent = vi.fn().mockResolvedValue({ data: PRIVACY });
    const updateAssistantConsent = vi.fn().mockResolvedValue({ data: { ...PRIVACY, storedConversationCount: 5 } });
    const deleteAssistantConversations = vi.fn().mockResolvedValue({ data: { deletedCount: 2 } });
    const createAssistantConversation = vi.fn().mockResolvedValue({ data: { id: "c-1", stored: false } });
    const endAssistantConversation = vi.fn().mockResolvedValue({ data: { id: "c-1", status: "resolved" } });
    const createAssistantActionResult = vi.fn().mockResolvedValue({ data: { recorded: true } });
    const api = createProxy({
      v1: {
        getAssistantConsent,
        updateAssistantConsent,
        deleteAssistantConversations,
        createAssistantConversation,
        endAssistantConversation,
        createAssistantActionResult
      }
    }) as unknown as ApiService;

    const { result } = setupQuery(input.useHook, { services: { api: () => api, queryClient: () => queryClient } });

    return {
      result,
      api,
      queryClient,
      getAssistantConsent,
      updateAssistantConsent,
      deleteAssistantConversations,
      createAssistantConversation,
      endAssistantConversation,
      createAssistantActionResult
    };
  }
});
