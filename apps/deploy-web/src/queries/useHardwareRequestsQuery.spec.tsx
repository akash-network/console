import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useHardwareRequestsQuery } from "./useHardwareRequestsQuery";

import { waitFor } from "@testing-library/react";
import { buildHardwareRequest } from "@tests/seeders/hardwareRequest";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

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
