import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useResolvedDeploymentName";
import { useResolvedDeploymentName } from "./useResolvedDeploymentName";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useResolvedDeploymentName.name, () => {
  it("resolves to the name the api holds", async () => {
    const { result } = setup({ apiName: "api-name" });

    await vi.waitFor(() => expect(result.current).toBe("api-name"));
  });

  it("asks the api for the deployment the caller named", async () => {
    const { getDeployment } = setup({ apiName: "api-name" });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalledWith({ dseq: "123" }));
  });

  it("resolves to nothing while the api's answer is still resolving", () => {
    const { result } = setup({ apiName: "api-name" });

    expect(result.current).toBeUndefined();
  });

  it("resolves to nothing when the api holds no name, leaving the caller its own placeholder", async () => {
    const { result, getDeployment } = setup({ apiName: null });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });

  it.each([401, 403, 404])("recovers a %s into no name instead of failing the query", async status => {
    const { result, onQueryError, queryStatus } = setup({ apiError: new ApiError(status, {}, `GET /v1/deployments/{dseq} → ${status}`) });

    await vi.waitFor(() => expect(queryStatus()).toBe("success"));
    expect(result.current).toBeUndefined();
    expect(onQueryError).not.toHaveBeenCalled();
  });

  it("reports a server error rather than silencing it", async () => {
    const { result, onQueryError, queryStatus } = setup({ apiError: new ApiError(500, {}, "GET /v1/deployments/{dseq} → 500") });

    await vi.waitFor(() => expect(onQueryError).toHaveBeenCalled());
    expect(queryStatus()).toBe("error");
    expect(result.current).toBeUndefined();
  });

  it("asks the api for nothing when there is no dseq", () => {
    const { result, getDeployment } = setup({ dseq: null, apiName: "api-name" });

    expect(getDeployment).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  function setup(input: { dseq?: string | null; apiName?: string | null; apiError?: Error }) {
    const getDeployment = vi.fn(() => {
      if (input.apiError) return Promise.reject(input.apiError);
      return Promise.resolve({ data: { name: input.apiName ?? null } });
    });
    const api = createProxy({ v1: { getDeployment } }) as unknown as ApiService;

    const onQueryError = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
      queryCache: new QueryCache({ onError: onQueryError })
    });

    /** `satisfies` type-checks the field against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    const { result } = setupQuery(() => useResolvedDeploymentName(input.dseq === undefined ? "123" : input.dseq, { useServices }), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return {
      result,
      getDeployment,
      onQueryError,
      queryStatus: () => queryClient.getQueryState(api.v1.getDeployment.getKey({ dseq: "123" }))?.status
    };
  }
});
