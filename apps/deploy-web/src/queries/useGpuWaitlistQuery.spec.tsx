import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useGpuWaitlistQuery, useJoinGpuWaitlistMutation, useKeepGpuWaitlistEntryMutation, useLeaveGpuWaitlistMutation } from "./useGpuWaitlistQuery";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const WAITLIST_KEY = ["v1", "listGpuWaitlist"];

describe("gpu waitlist queries", () => {
  it("unwraps the waiting entries from the response envelope", async () => {
    const entries = [{ id: "entry-1" }];
    const { result, listGpuWaitlist } = setup({ useHookUnderTest: () => useGpuWaitlistQuery(), listGpuWaitlist: vi.fn().mockResolvedValue({ data: entries }) });

    await waitFor(() => expect(result.current.data).toEqual(entries));
    expect(listGpuWaitlist).toHaveBeenCalledOnce();
  });

  it("does not query while disabled", async () => {
    const { listGpuWaitlist } = setup({ useHookUnderTest: () => useGpuWaitlistQuery({ enabled: false }) });

    await act(() => new Promise(resolve => setTimeout(resolve, 20)));

    expect(listGpuWaitlist).not.toHaveBeenCalled();
  });

  it.each([
    ["join", useJoinGpuWaitlistMutation, "joinGpuWaitlist", { data: { vendor: "nvidia", model: "h100", gpuCount: 2, source: "gpu_menu" } }],
    ["leave", useLeaveGpuWaitlistMutation, "leaveGpuWaitlist", { id: "entry-1" }],
    ["keep", useKeepGpuWaitlistEntryMutation, "keepGpuWaitlistEntry", { id: "entry-1" }]
  ] as const)("refreshes the waitlist after a %s", async (_, useMutationHook, operation, input) => {
    const run = vi.fn().mockResolvedValue({ data: {} });
    const { result, queryClient } = setup({ useHookUnderTest: () => useMutationHook(), operations: { [operation]: run } });

    await act(async () => {
      await result.current.mutateAsync(input as never);
    });

    expect(run).toHaveBeenCalledWith(input);
    expect(queryClient.getQueryState(WAITLIST_KEY)?.isInvalidated).toBe(true);
  });

  it("refreshes the waitlist when leaving is refused", async () => {
    const { result, queryClient } = setup({
      useHookUnderTest: () => useLeaveGpuWaitlistMutation(),
      operations: { leaveGpuWaitlist: vi.fn().mockRejectedValue(new Error("gone")) }
    });

    await act(() => result.current.mutateAsync({ id: "entry-1" }).catch(() => undefined));

    expect(queryClient.getQueryState(WAITLIST_KEY)?.isInvalidated).toBe(true);
  });

  it.each([
    ["leave", useLeaveGpuWaitlistMutation, "leaveGpuWaitlist"],
    ["keep", useKeepGpuWaitlistEntryMutation, "keepGpuWaitlistEntry"]
  ] as const)("does not report a 404 on %s as a fault", async (_, useMutationHook, operation) => {
    const { result, queryClient } = setup({
      useHookUnderTest: () => useMutationHook(),
      operations: { [operation]: vi.fn().mockRejectedValue(new ApiError(404, undefined, "gone")) }
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "entry-1" } as never).catch(() => undefined);
    });

    const skipErrorReporting = queryClient.getMutationCache().getAll()[0].meta?.skipErrorReporting as (error: unknown) => boolean;
    expect(skipErrorReporting(new ApiError(404, undefined, "gone"))).toBe(true);
    expect(skipErrorReporting(new ApiError(500, undefined, "boom"))).toBe(false);
  });

  function setup<T>(input: { useHookUnderTest: () => T; listGpuWaitlist?: ReturnType<typeof vi.fn>; operations?: Record<string, ReturnType<typeof vi.fn>> }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    queryClient.setQueryData(WAITLIST_KEY, { data: [] });
    const listGpuWaitlist = input.listGpuWaitlist ?? vi.fn();
    const api = createProxy({ v1: { listGpuWaitlist, ...input.operations } }) as unknown as ApiService;
    const { result } = setupQuery(input.useHookUnderTest, { services: { api: () => api, queryClient: () => queryClient } });

    return { result, listGpuWaitlist, queryClient };
  }
});
