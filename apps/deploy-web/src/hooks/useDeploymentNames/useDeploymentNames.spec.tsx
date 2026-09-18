import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import { settingsIdAtom } from "@src/store/settingsStore";
import type { DEPENDENCIES } from "./useDeploymentNames";
import { MAX_DSEQS_PER_NAMES_LOOKUP, MAX_NAMED_DEPLOYMENTS, useDeploymentNames } from "./useDeploymentNames";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useDeploymentNames.name, () => {
  it("prefers the name the api holds over the one this browser recorded", async () => {
    const { result } = setup({ dseqs: ["100"], apiNames: { "100": "api-name" }, localNames: { "100": "local-name" } });

    await vi.waitFor(() => expect(result.current.getDeploymentName("100")).toBe("api-name"));
  });

  it("asks the api once for the whole page, sorted and without repeats", async () => {
    const { listDeploymentNames } = setup({ dseqs: ["300", "100", 200, "100"] });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalledExactlyOnceWith({ dseq: ["100", "200", "300"] }));
  });

  it("falls back to this browser's record for a deployment the api holds no name for", async () => {
    const { result, listDeploymentNames } = setup({ dseqs: ["100", "200"], apiNames: { "100": null }, localNames: { "100": "local-100", "200": "local-200" } });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalled());
    expect(result.current.getDeploymentName("100")).toBe("local-100");
    expect(result.current.getDeploymentName("200")).toBe("local-200");
  });

  it("reads this browser's record under the wallet the app recorded", async () => {
    const { result, deploymentLocalStorage } = setup({ dseqs: ["100"], localNames: { "100": "local-name" } });

    await vi.waitFor(() => expect(result.current.getDeploymentName("100")).toBe("local-name"));
    expect(deploymentLocalStorage.get).toHaveBeenCalledWith("akash1test", "100");
  });

  it("serves this browser's record while the api's answer is still resolving", () => {
    const { result } = setup({ dseqs: ["100"], apiNames: { "100": "api-name" }, localNames: { "100": "local-name" } });

    expect(result.current.getDeploymentName("100")).toBe("local-name");
  });

  it("resolves to null when neither holds a name, leaving the surface its own placeholder", async () => {
    const { result, listDeploymentNames } = setup({ dseqs: ["100"], apiNames: { "100": null } });

    await vi.waitFor(() => expect(listDeploymentNames).toHaveBeenCalled());
    expect(result.current.getDeploymentName("100")).toBeNull();
  });

  it("resolves to null for no dseq at all, without reading this browser's record", () => {
    const { result, deploymentLocalStorage } = setup({ dseqs: ["100"], apiNames: { "100": "api-name" } });

    expect(result.current.getDeploymentName(null)).toBeNull();
    expect(result.current.getDeploymentName(undefined)).toBeNull();
    expect(result.current.getDeploymentName("")).toBeNull();
    expect(deploymentLocalStorage.get).not.toHaveBeenCalled();
  });

  it("hands the api's answers to the backfill once they arrive", async () => {
    const { useDeploymentNameBackfill } = setup({ dseqs: ["100", "200"], apiNames: { "100": null, "200": "api-name" } });

    await vi.waitFor(() =>
      expect(useDeploymentNameBackfill).toHaveBeenLastCalledWith([
        { dseq: "100", name: null },
        { dseq: "200", name: "api-name" }
      ])
    );
  });

  it("hands the backfill nothing while the api is still answering", () => {
    const { useDeploymentNameBackfill } = setup({ dseqs: ["100"], apiNames: { "100": null }, localNames: { "100": "local-name" } });

    expect(useDeploymentNameBackfill).toHaveBeenLastCalledWith([]);
  });

  it("hands the backfill nothing for a lookup the api refused, whose answers are then unknown", async () => {
    const { useDeploymentNameBackfill, settleLookups } = setup({
      dseqs: ["100"],
      apiError: new ApiError(401, {}, "GET /v1/deployment-names \u2192 401"),
      localNames: { "100": "local-name" }
    });

    await settleLookups();

    expect(useDeploymentNameBackfill).toHaveBeenLastCalledWith([]);
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

  it("asks the api for nothing when the surface holds more deployments than it will name, and still answers from this browser's record", () => {
    const dseqs = Array.from({ length: MAX_NAMED_DEPLOYMENTS + 1 }, (_, index) => String(1000 + index));
    const { result, listDeploymentNames, queryClient } = setup({ dseqs, localNames: { "1000": "local-name" } });

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(listDeploymentNames).not.toHaveBeenCalled();
    expect(result.current.getDeploymentName("1000")).toBe("local-name");
  });

  it("names a deployment from whichever lookup answered for it", async () => {
    const dseqs = Array.from({ length: MAX_DSEQS_PER_NAMES_LOOKUP + 1 }, (_, index) => String(1000 + index));
    const [first] = dseqs;
    const last = dseqs[dseqs.length - 1];
    const { result } = setup({ dseqs, apiNames: { [first]: "first", [last]: "last" } });

    await vi.waitFor(() => expect(result.current.getDeploymentName(last)).toBe("last"));
    expect(result.current.getDeploymentName(first)).toBe("first");
  });

  it.each([401, 403, 404])("recovers a %s into this browser's record instead of failing the lookup", async status => {
    const { result, onQueryError, settleLookups } = setup({
      dseqs: ["100"],
      apiError: new ApiError(status, {}, `GET /v1/deployment-names → ${status}`),
      localNames: { "100": "local-name" }
    });

    await settleLookups();

    expect(onQueryError).not.toHaveBeenCalled();
    expect(result.current.getDeploymentName("100")).toBe("local-name");
  });

  it("recovers a browser that cannot reach the api at all into this browser's record", async () => {
    const { result, onQueryError, settleLookups } = setup({ dseqs: ["100"], apiError: new TypeError("Failed to fetch"), localNames: { "100": "local-name" } });

    await settleLookups();

    expect(onQueryError).not.toHaveBeenCalled();
    expect(result.current.getDeploymentName("100")).toBe("local-name");
  });

  it("reports a server error rather than silencing it, and still falls back", async () => {
    const { result, onQueryError } = setup({
      dseqs: ["100"],
      apiError: new ApiError(500, {}, "GET /v1/deployment-names → 500"),
      localNames: { "100": "local-name" }
    });

    await vi.waitFor(() => expect(onQueryError).toHaveBeenCalled());
    expect(result.current.getDeploymentName("100")).toBe("local-name");
  });

  function setup(input: {
    dseqs: Array<string | number | null | undefined>;
    apiNames?: Record<string, string | null>;
    apiError?: Error;
    localNames?: Record<string, string>;
  }) {
    const useDeploymentNameBackfill = vi.fn<typeof DEPENDENCIES.useDeploymentNameBackfill>();
    const listDeploymentNames = vi.fn(({ dseq }: { dseq: string[] }) => {
      if (input.apiError) return Promise.reject(input.apiError);

      return Promise.resolve({ data: Object.fromEntries(dseq.map(asked => [asked, input.apiNames?.[asked] ?? null])) });
    });
    const api = createProxy({ v1: { listDeploymentNames } }) as unknown as ApiService;

    const deploymentLocalStorage = mock<DeploymentStorageService>({
      get: vi.fn((address, dseq) => {
        const name = address && dseq ? input.localNames?.[String(dseq)] : undefined;

        return name ? { name } : null;
      })
    });

    const onQueryError = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
      queryCache: new QueryCache({ onError: onQueryError })
    });

    /** `satisfies` type-checks both fields against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api, deploymentLocalStorage } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    const store = createStore();
    store.set(settingsIdAtom, "akash1test");

    let dseqs = input.dseqs;
    const { result, rerender } = setupQuery(() => useDeploymentNames(dseqs, { useServices, useDeploymentNameBackfill }), {
      services: { api: () => api, deploymentLocalStorage: () => deploymentLocalStorage, queryClient: () => queryClient },
      wrapper: ({ children }) => <JotaiStoreProvider store={store}>{children}</JotaiStoreProvider>
    });

    return {
      result,
      listDeploymentNames,
      useDeploymentNameBackfill,
      deploymentLocalStorage,
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
