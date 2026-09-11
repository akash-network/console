import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import type { DEPENDENCIES } from "./useResolvedDeploymentName";
import { useResolvedDeploymentName } from "./useResolvedDeploymentName";

import { buildWallet } from "@tests/seeders/wallet";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useResolvedDeploymentName.name, () => {
  it("prefers the name the api holds over the one this browser recorded", async () => {
    const { result } = setup({ apiName: "api-name", localName: "local-name" });

    await vi.waitFor(() => expect(result.current).toBe("api-name"));
  });

  it("asks the api for the deployment the caller named", async () => {
    const { getDeployment } = setup({ apiName: "api-name" });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalledWith({ dseq: "123" }));
  });

  it("falls back to this browser's record when the api holds no name", async () => {
    const { result, getDeployment } = setup({ apiName: null, localName: "local-name" });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalled());
    expect(result.current).toBe("local-name");
  });

  it("serves this browser's record while the api's answer is still resolving", () => {
    const { result } = setup({ apiName: "api-name", localName: "local-name" });

    expect(result.current).toBe("local-name");
  });

  it("resolves to nothing when neither holds a name, leaving the caller its own placeholder", async () => {
    const { result, getDeployment } = setup({ apiName: null });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });

  it.each([401, 403, 404])("recovers a %s into this browser's record instead of failing the query", async status => {
    const { result, onQueryError, queryStatus } = setup({
      apiError: new ApiError(status, {}, `GET /v1/deployments/{dseq} → ${status}`),
      localName: "local-name"
    });

    await vi.waitFor(() => expect(queryStatus()).toBe("success"));
    expect(result.current).toBe("local-name");
    expect(onQueryError).not.toHaveBeenCalled();
  });

  it("reports a server error rather than silencing it, and still falls back", async () => {
    const { result, onQueryError, queryStatus } = setup({ apiError: new ApiError(500, {}, "GET /v1/deployments/{dseq} → 500"), localName: "local-name" });

    await vi.waitFor(() => expect(onQueryError).toHaveBeenCalled());
    expect(queryStatus()).toBe("error");
    expect(result.current).toBe("local-name");
  });

  it("asks the api for nothing when there is no dseq", () => {
    const { result, getDeployment } = setup({ dseq: null, apiName: "api-name", localName: "local-name" });

    expect(getDeployment).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  function setup(input: { dseq?: string | null; apiName?: string | null; apiError?: Error; localName?: string }) {
    const getDeployment = vi.fn(() => {
      if (input.apiError) return Promise.reject(input.apiError);
      return Promise.resolve({ data: { name: input.apiName ?? null } });
    });
    const api = createProxy({ v1: { getDeployment } }) as unknown as ApiService;

    const deploymentLocalStorage = mock<DeploymentStorageService>({
      get: vi.fn((_address, dseq) => (dseq && input.localName ? { name: input.localName } : null))
    });

    const onQueryError = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
      queryCache: new QueryCache({ onError: onQueryError })
    });

    const useWallet: typeof DEPENDENCIES.useWallet = () => buildWallet({ address: "akash1test" });
    /** `satisfies` type-checks both fields against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api, deploymentLocalStorage } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    const { result } = setupQuery(() => useResolvedDeploymentName(input.dseq === undefined ? "123" : input.dseq, { useServices, useWallet }), {
      services: { api: () => api, deploymentLocalStorage: () => deploymentLocalStorage, queryClient: () => queryClient }
    });

    return {
      result,
      getDeployment,
      deploymentLocalStorage,
      onQueryError,
      queryStatus: () => queryClient.getQueryState(api.v1.getDeployment.getKey({ dseq: "123" }))?.status
    };
  }
});
