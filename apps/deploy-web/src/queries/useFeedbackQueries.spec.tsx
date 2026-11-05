import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useCreateFeedbackMutation, useFeedbackOutcomePromptQuery } from "./useFeedbackQueries";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe("useFeedbackQueries", () => {
  describe(useFeedbackOutcomePromptQuery.name, () => {
    it("unwraps the prompt eligibility of the deployment", async () => {
      const prompt = { dseq: "11", eligible: true, reason: null };
      const { result, getFeedbackOutcomePrompt } = setup({ useHook: () => useFeedbackOutcomePromptQuery("11", { enabled: true }), prompt });

      await waitFor(() => expect(result.current.data).toEqual(prompt));
      expect(getFeedbackOutcomePrompt).toHaveBeenCalledWith(expect.objectContaining({ dseq: "11" }));
    });

    it("does not load while disabled", () => {
      const { result, getFeedbackOutcomePrompt } = setup({ useHook: () => useFeedbackOutcomePromptQuery("11", { enabled: false }) });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getFeedbackOutcomePrompt).not.toHaveBeenCalled();
    });
  });

  describe(useCreateFeedbackMutation.name, () => {
    it("sends the feedback", async () => {
      const { result, createFeedback } = setup({ useHook: () => useCreateFeedbackMutation() });
      const body = { data: { kind: "general" as const, category: "bug" as const, message: "Logs are empty" } };

      await act(() => result.current.mutateAsync(body));

      expect(createFeedback).toHaveBeenCalledWith(body);
    });
  });

  function setup<T>(input: { useHook: () => T; prompt?: unknown }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getFeedbackOutcomePrompt = vi.fn().mockResolvedValue({ data: input.prompt });
    const createFeedback = vi.fn().mockResolvedValue({ data: { id: "f-1", createdAt: "2026-11-04T00:00:00.000Z" } });
    const api = createProxy({ v1: { getFeedbackOutcomePrompt, createFeedback } }) as unknown as ApiService;

    const { result } = setupQuery(input.useHook, { services: { api: () => api, queryClient: () => queryClient } });

    return { result, getFeedbackOutcomePrompt, createFeedback };
  }
});
