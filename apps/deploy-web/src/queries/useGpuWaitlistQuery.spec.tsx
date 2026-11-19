import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useGpuWaitlistQuery, useJoinGpuWaitlistMutation, useKeepGpuWaitlistEntryMutation, useLeaveGpuWaitlistMutation } from "./useGpuWaitlistQuery";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const WAITLIST_KEY = ["v1", "listGpuWaitlist"];

describe(useGpuWaitlistQuery.name, () => {
  it("unwraps the waiting entries from the response envelope", async () => {
    const entries = [{ id: "entry-1" }];
    const { result, listGpuWaitlist } = setup({ listGpuWaitlist: vi.fn().mockResolvedValue({ data: entries }) });

    await waitFor(() => expect(result.current.data).toEqual(entries));
    expect(listGpuWaitlist).toHaveBeenCalledOnce();

    function setup(operations: { listGpuWaitlist: ReturnType<typeof vi.fn> }) {
      const api = createProxy({ v1: operations }) as unknown as ApiService;
      const { result } = setupQuery(() => useGpuWaitlistQuery(), { services: { api: () => api, queryClient: () => new QueryClient() } });
      return { result, ...operations };
    }
  });

  it("does not query while disabled", () => {
    const listGpuWaitlist = vi.fn();
    const api = createProxy({ v1: { listGpuWaitlist } }) as unknown as ApiService;

    setupQuery(() => useGpuWaitlistQuery({ enabled: false }), { services: { api: () => api, queryClient: () => new QueryClient() } });

    expect(listGpuWaitlist).not.toHaveBeenCalled();
  });
});

describe("waitlist mutations", () => {
  it.each([
    ["join", useJoinGpuWaitlistMutation, "joinGpuWaitlist", { data: { vendor: "nvidia", model: "h100", gpuCount: 2, source: "gpu_menu" } }],
    ["leave", useLeaveGpuWaitlistMutation, "leaveGpuWaitlist", { id: "entry-1" }],
    ["keep", useKeepGpuWaitlistEntryMutation, "keepGpuWaitlistEntry", { id: "entry-1" }]
  ] as const)("refreshes the waitlist after a %s", async (_, useMutationHook, operation, input) => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(WAITLIST_KEY, { data: [] });
    const run = vi.fn().mockResolvedValue({ data: {} });
    const api = createProxy({ v1: { [operation]: run, listGpuWaitlist: vi.fn() } }) as unknown as ApiService;

    const { result } = setupQuery(() => useMutationHook(), { services: { api: () => api, queryClient: () => queryClient } });
    await act(async () => {
      await result.current.mutateAsync(input as never);
    });

    expect(run).toHaveBeenCalledWith(input);
    expect(queryClient.getQueryState(WAITLIST_KEY)?.isInvalidated).toBe(true);
  });

  it("refreshes the waitlist when leaving is refused", async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(WAITLIST_KEY, { data: [] });
    const api = createProxy({ v1: { leaveGpuWaitlist: vi.fn().mockRejectedValue(new Error("gone")), listGpuWaitlist: vi.fn() } }) as unknown as ApiService;

    const { result } = setupQuery(() => useLeaveGpuWaitlistMutation(), { services: { api: () => api, queryClient: () => queryClient } });
    await act(() => result.current.mutateAsync({ id: "entry-1" }).catch(() => undefined));

    expect(queryClient.getQueryState(WAITLIST_KEY)?.isInvalidated).toBe(true);
  });
});
