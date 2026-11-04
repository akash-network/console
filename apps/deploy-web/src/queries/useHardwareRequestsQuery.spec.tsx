import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useHardwareRequestsQuery, useWithdrawHardwareRequestMutation } from "./useHardwareRequestsQuery";

import { act, waitFor } from "@testing-library/react";
import { buildHardwareRequest } from "@tests/seeders/hardwareRequest";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const REQUESTS_KEY = ["v1", "listHardwareRequests"];

describe(useHardwareRequestsQuery.name, () => {
  it("unwraps the organization's requests from the response envelope", async () => {
    const requests = [buildHardwareRequest()];
    const { result, listHardwareRequests } = setup({ requests });

    await waitFor(() => expect(result.current.data).toEqual(requests));
    expect(listHardwareRequests).toHaveBeenCalledOnce();
  });

  function setup(input: { requests: unknown[] }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listHardwareRequests = vi.fn().mockResolvedValue({ data: input.requests });
    const api = createProxy({ v1: { listHardwareRequests } }) as unknown as ApiService;

    const { result } = setupQuery(() => useHardwareRequestsQuery(), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return { result, listHardwareRequests };
  }
});

describe(useWithdrawHardwareRequestMutation.name, () => {
  it("withdraws the request and refreshes the list", async () => {
    const { result, withdrawHardwareRequest, queryClient } = setup({ outcome: Promise.resolve({ data: buildHardwareRequest({ status: "withdrawn" }) }) });

    await act(() => result.current.mutateAsync({ id: "request-1" }));

    expect(withdrawHardwareRequest).toHaveBeenCalledWith({ id: "request-1" });
    expect(queryClient.getQueryState(REQUESTS_KEY)?.isInvalidated).toBe(true);
  });

  it("refreshes the list when the withdrawal is refused", async () => {
    const { result, queryClient } = setup({ outcome: Promise.reject(new Error("already accepted")) });

    await act(() => result.current.mutateAsync({ id: "request-1" }).catch(() => undefined));

    expect(queryClient.getQueryState(REQUESTS_KEY)?.isInvalidated).toBe(true);
  });

  function setup(input: { outcome: Promise<unknown> }) {
    input.outcome.catch(() => undefined);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(REQUESTS_KEY, { data: [] });
    const withdrawHardwareRequest = vi.fn(() => input.outcome);
    const api = createProxy({ v1: { withdrawHardwareRequest, listHardwareRequests: vi.fn() } }) as unknown as ApiService;

    const { result } = setupQuery(() => useWithdrawHardwareRequestMutation(), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return { result, withdrawHardwareRequest, queryClient };
  }
});
