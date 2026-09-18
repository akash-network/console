import type { LoggerService } from "@akashnetwork/logging";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import { DeploymentNameBackfillService } from "@src/services/deployment-name-backfill/deployment-name-backfill.service";
import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import { settingsIdAtom } from "@src/store/settingsStore";
import type { ApiDeploymentName, DEPENDENCIES } from "./useDeploymentNameBackfill";
import { useDeploymentNameBackfill } from "./useDeploymentNameBackfill";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useDeploymentNameBackfill.name, () => {
  it("records the name this browser holds for a deployment the api answered has none", async () => {
    const { patchDeployment } = setup({ apiNames: [answered("100", null)], localNames: { "100": "local-name" } });

    await vi.waitFor(() => expect(patchDeployment).toHaveBeenCalledExactlyOnceWith({ dseq: "100", data: { name: "local-name" } }));
  });

  it("leaves a deployment the api already names alone, so a rename made elsewhere is not undone", () => {
    const { patchDeployment } = setup({ apiNames: [answered("100", "api-name")], localNames: { "100": "local-name" } });

    expect(patchDeployment).not.toHaveBeenCalled();
  });

  it.each(["", "   "])("leaves a deployment this browser recorded %p as a name for alone", localName => {
    const { patchDeployment } = setup({ apiNames: [answered("100", null)], localNames: { "100": localName } });

    expect(patchDeployment).not.toHaveBeenCalled();
  });

  it("records nothing until the app knows which wallet the names belong to", () => {
    const { patchDeployment } = setup({ apiNames: [answered("100", null)], localNames: { "100": "local-name" }, address: null });

    expect(patchDeployment).not.toHaveBeenCalled();
  });

  it("holds a recorded name to the length the api accepts, so the backfill is not refused over it", async () => {
    const { patchDeployment } = setup({ apiNames: [answered("100", null)], localNames: { "100": "a".repeat(MAX_DEPLOYMENT_NAME_LENGTH + 10) } });

    await vi.waitFor(() => expect(patchDeployment).toHaveBeenCalledWith({ dseq: "100", data: { name: "a".repeat(MAX_DEPLOYMENT_NAME_LENGTH) } }));
  });

  it("refreshes the deployment, the names lookup and the deployments pages once the api accepted the name", async () => {
    const { invalidateQueries, api } = setup({ apiNames: [answered("100", null)], localNames: { "100": "local-name" } });

    await vi.waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getDeployment.getKey({ dseq: "100" }) }));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.listDeploymentNames.getKey() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.listDeployments.getKey() });
  });

  it("reports a refused backfill and refreshes nothing", async () => {
    const { logger, invalidateQueries } = setup({
      apiNames: [answered("100", null)],
      localNames: { "100": "local-name" },
      apiError: new ApiError(404, {}, "PATCH /v1/deployments/{dseq} → 404")
    });

    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_NAME_BACKFILL_FAILED", dseq: "100" })));
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("asks the mutation cache not to report a refusal it expects, while leaving a server fault reported", async () => {
    const { queryClient } = setup({ apiNames: [answered("100", null)], localNames: { "100": "local-name" } });

    await vi.waitFor(() => expect(queryClient.getMutationCache().getAll()).not.toHaveLength(0));
    expect(queryClient.getMutationCache().getAll()[0].options.meta).toBe(SKIP_REPORTING_BELOW_SERVER_ERROR);
  });

  it("hands a deployment to the backfill once however often its surface re-renders with the same answers", async () => {
    const { enqueue, rerenderWith } = setup({ apiNames: [answered("100", null)], localNames: { "100": "local-name" } });

    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
    rerenderWith([answered("100", null)]);

    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("hands the backfill the wallet the name belongs to, since the same dseq recurs under another", async () => {
    const { enqueue } = setup({ apiNames: [answered("100", null)], localNames: { "100": "local-name" } });

    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledExactlyOnceWith("akash1test", "100", expect.any(Function)));
  });

  it("asks the api to record one name at a time", async () => {
    const { patchDeployment } = setup({
      apiNames: [answered("100", null), answered("200", null)],
      localNames: { "100": "first", "200": "second" },
      isApiUnanswered: true
    });

    await vi.waitFor(() => expect(patchDeployment).toHaveBeenCalled());
    expect(patchDeployment).toHaveBeenCalledExactlyOnceWith({ dseq: "100", data: { name: "first" } });
  });

  function answered(dseq: string, name: string | null): ApiDeploymentName {
    return { dseq, name };
  }

  function setup(input: {
    apiNames: ApiDeploymentName[];
    localNames?: Record<string, string>;
    address?: string | null;
    apiError?: Error;
    isApiUnanswered?: boolean;
  }) {
    const patchDeployment = vi.fn(() => {
      if (input.apiError) return Promise.reject(input.apiError);
      if (input.isApiUnanswered) return new Promise(() => undefined);

      return Promise.resolve({ data: { name: "recorded" } });
    });
    const api = createProxy({
      v1: { patchDeployment, getDeployment: vi.fn(), listDeploymentNames: vi.fn(), listDeployments: vi.fn() }
    }) as unknown as ApiService;

    const deploymentLocalStorage = mock<DeploymentStorageService>({
      get: vi.fn((address, dseq) => {
        const name = address && dseq ? input.localNames?.[String(dseq)] : undefined;

        return name === undefined ? null : { name };
      })
    });
    const deploymentNameBackfill = new DeploymentNameBackfillService();
    const enqueue = vi.spyOn(deploymentNameBackfill, "enqueue");
    const logger = mock<LoggerService>();

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    /** `satisfies` type-checks the fields against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api, deploymentLocalStorage, deploymentNameBackfill, logger } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;
    const useQueryClient: typeof DEPENDENCIES.useQueryClient = () => queryClient;

    const store = createStore();
    store.set(settingsIdAtom, input.address === undefined ? "akash1test" : input.address);

    let apiNames = input.apiNames;
    const { rerender } = setupQuery(() => useDeploymentNameBackfill(apiNames, { useServices, useQueryClient }), {
      services: { api: () => api, deploymentLocalStorage: () => deploymentLocalStorage, queryClient: () => queryClient },
      wrapper: ({ children }) => <JotaiStoreProvider store={store}>{children}</JotaiStoreProvider>
    });

    return {
      api,
      patchDeployment,
      deploymentLocalStorage,
      enqueue,
      logger,
      queryClient,
      invalidateQueries,
      rerenderWith(next: ApiDeploymentName[]) {
        apiNames = next;
        rerender();
      }
    };
  }
});
