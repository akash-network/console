import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useDeploymentNames";
import { MAX_DSEQS_PER_NAMES_LOOKUP, MAX_NAMED_DEPLOYMENTS, useDeploymentNames } from "./useDeploymentNames";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useDeploymentNames.name, () => {
  it("resolves to the name the api holds", async () => {
    const { result } = setup({ dseqs: ["100"], apiNames: { "100": "api-name" } });

    await vi.waitFor(() => expect(result.current.getDeploymentName("100")).toBe("api-name"));
  });

  it("asks the api once for the whole page, sorted and without repeats", async () => {
    const { listDeploymentNames } = setup({ dseqs: ["300", "100", 200, "100"] });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalledExactlyOnceWith({ dseq: ["100", "200", "300"] }));
  });

  it("resolves to null while the api's answer is still resolving", () => {
    const { result } = setup({ dseqs: ["100"], apiNames: { "100": "api-name" } });

    expect(result.current.getDeploymentName("100")).toBeNull();
  });

  it("resolves to null when the api holds no name, leaving the surface its own placeholder", async () => {
    const { result, listDeploymentNames } = setup({ dseqs: ["100"], apiNames: { "100": null } });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalled());
    expect(result.current.getDeploymentName("100")).toBeNull();
  });

  it("resolves to null for no dseq at all", async () => {
    const { result, settleLookups } = setup({ dseqs: ["100"], apiNames: { "100": "api-name" } });

    await settleLookups();

    expect(result.current.getDeploymentName(null)).toBeNull();
    expect(result.current.getDeploymentName(undefined)).toBeNull();
    expect(result.current.getDeploymentName("")).toBeNull();
  });

  it("reports the names as loading until the api has answered", async () => {
    const { result } = setup({ dseqs: ["100"], apiNames: { "100": "api-name" } });

    expect(result.current.isLoading).toBe(true);
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("reports the names as loading from the first render that holds a deployment it had not named yet", async () => {
    const { result, rerenderWith, settleLookups } = setup({ dseqs: ["100"], apiNames: { "100": "api-name", "200": "storefront" } });
    await settleLookups();

    rerenderWith(["100", "200"]);

    expect(result.current.isLoading).toBe(true);
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getDeploymentName("200")).toBe("storefront");
  });

  it("reports nothing loading once a lookup the server failed has given up", async () => {
    const { result, rerenderWith, settleLookups } = setup({ dseqs: [], apiError: new ApiError(500, {}, "GET /v1/deployment-names → 500") });

    rerenderWith(["100"]);
    const isLoadingWhileAsking = result.current.isLoading;
    await settleLookups();

    expect(isLoadingWhileAsking).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.getDeploymentName("100")).toBeNull();
  });

  it("reports nothing loading when there is no deployment to name", () => {
    const { result } = setup({ dseqs: [] });

    expect(result.current.isLoading).toBe(false);
  });

  it.each([
    { case: "refused", apiError: new ApiError(401, {}, "GET /v1/deployment-names → 401") },
    { case: "failed on the server", apiError: new ApiError(500, {}, "GET /v1/deployment-names → 500") }
  ])("stops loading once a lookup the api $case is settled", async ({ apiError }) => {
    const { result, settleLookups } = setup({ dseqs: ["100"], apiError });

    await settleLookups();

    expect(result.current.isLoading).toBe(false);
  });

  it("asks the api for nothing when there is no deployment to name", () => {
    const { listDeploymentNames } = setup({ dseqs: [null, undefined, ""] });

    expect(listDeploymentNames).not.toHaveBeenCalled();
  });

  it("leaves a blank dseq out of a lookup that has deployments to name", async () => {
    const { listDeploymentNames } = setup({ dseqs: ["100", ""] });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalledExactlyOnceWith({ dseq: ["100"] }));
  });

  it("asks again once the surface holds a deployment it had not named yet", async () => {
    const { listDeploymentNames, rerenderWith } = setup({ dseqs: ["100"] });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalledExactlyOnceWith({ dseq: ["100"] }));

    rerenderWith(["100", "200"]);

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenLastCalledWith({ dseq: ["100", "200"] }));
  });

  it("splits a list longer than one lookup may carry into several, each within the bound", async () => {
    const dseqs = Array.from({ length: MAX_DSEQS_PER_NAMES_LOOKUP * 2 + 1 }, (_, index) => String(1000 + index));
    const { listDeploymentNames } = setup({ dseqs });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalledTimes(3));
    const asked = listDeploymentNames.mock.calls.map(([input]) => input.dseq);
    expect(asked.every(lookup => lookup.length <= MAX_DSEQS_PER_NAMES_LOOKUP)).toBe(true);
    expect(asked.flat().sort()).toEqual([...dseqs].sort());
  });

  it("still names a surface holding exactly as many deployments as it will name", async () => {
    const dseqs = Array.from({ length: MAX_NAMED_DEPLOYMENTS }, (_, index) => String(1000 + index));
    const { listDeploymentNames } = setup({ dseqs });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalledTimes(MAX_NAMED_DEPLOYMENTS / MAX_DSEQS_PER_NAMES_LOOKUP));
  });

  it("asks the api for nothing when the surface holds more deployments than it will name, and names none of them", () => {
    const dseqs = Array.from({ length: MAX_NAMED_DEPLOYMENTS + 1 }, (_, index) => String(1000 + index));
    const { result, listDeploymentNames, queryClient } = setup({ dseqs });

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(listDeploymentNames).not.toHaveBeenCalled();
    expect(result.current.getDeploymentName("1000")).toBeNull();
  });

  it("names a deployment from whichever lookup answered for it", async () => {
    const dseqs = Array.from({ length: MAX_DSEQS_PER_NAMES_LOOKUP + 1 }, (_, index) => String(1000 + index));
    const [first] = dseqs;
    const last = dseqs[dseqs.length - 1];
    const { result } = setup({ dseqs, apiNames: { [first]: "first", [last]: "last" } });

    await vi.waitFor(() => expect(result.current.getDeploymentName(last)).toBe("last"));
    expect(result.current.getDeploymentName(first)).toBe("first");
  });

  it.each([401, 403, 404])("recovers a %s into no name instead of failing the lookup", async status => {
    const { result, onQueryError, settleLookups } = setup({ dseqs: ["100"], apiError: new ApiError(status, {}, `GET /v1/deployment-names → ${status}`) });

    await settleLookups();

    expect(onQueryError).not.toHaveBeenCalled();
    expect(result.current.getDeploymentName("100")).toBeNull();
  });

  it("recovers a browser that cannot reach the api at all into no name", async () => {
    const { result, onQueryError, settleLookups } = setup({ dseqs: ["100"], apiError: new TypeError("Failed to fetch") });

    await settleLookups();

    expect(onQueryError).not.toHaveBeenCalled();
    expect(result.current.getDeploymentName("100")).toBeNull();
  });

  it("reports a server error rather than silencing it", async () => {
    const { result, onQueryError } = setup({ dseqs: ["100"], apiError: new ApiError(500, {}, "GET /v1/deployment-names → 500") });

    await vi.waitFor(() => expect(onQueryError).toHaveBeenCalled());
    expect(result.current.getDeploymentName("100")).toBeNull();
  });

  function setup(input: { dseqs: Array<string | number | null | undefined>; apiNames?: Record<string, string | null>; apiError?: Error }) {
    const listDeploymentNames = vi.fn(({ dseq }: { dseq: string[] }) => {
      if (input.apiError) return Promise.reject(input.apiError);

      return Promise.resolve({ data: Object.fromEntries(dseq.map(asked => [asked, input.apiNames?.[asked] ?? null])) });
    });
    const api = createProxy({ v1: { listDeploymentNames } }) as unknown as ApiService;

    const onQueryError = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
      queryCache: new QueryCache({ onError: onQueryError })
    });

    /** `satisfies` type-checks the field against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    let dseqs = input.dseqs;
    const { result, rerender } = setupQuery(() => useDeploymentNames(dseqs, { useServices }), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return {
      result,
      listDeploymentNames,
      onQueryError,
      queryClient,
      rerenderWith(next: Array<string | number | null | undefined>) {
        dseqs = next;
        rerender();
      },
      async settleLookups() {
        await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalled());
        await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
      }
    };
  }
});
