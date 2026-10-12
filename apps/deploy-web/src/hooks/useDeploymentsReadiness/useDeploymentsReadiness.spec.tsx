import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES, DeploymentState } from "./useDeploymentsReadiness";
import { readinessOf, useDeploymentsReadiness } from "./useDeploymentsReadiness";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useDeploymentsReadiness.name, () => {
  it("reads every deployment it is given, with its name and how ready it is", async () => {
    const { result, getDeployment } = setup({
      dseqs: ["1", "2"],
      deployments: {
        "1": { name: "storefront", ...deploymentWith([leaseReporting({ web: 1 })]) },
        "2": { name: null, ...deploymentWith([leaseReporting({ web: 0 })]) }
      }
    });

    await vi.waitFor(() =>
      expect(result.current).toEqual([
        { dseq: "1", name: "storefront", readiness: "ready" },
        { dseq: "2", name: null, readiness: "starting" }
      ])
    );
    expect(getDeployment).toHaveBeenCalledWith({ dseq: "1" });
    expect(getDeployment).toHaveBeenCalledWith({ dseq: "2" });
  });

  it("leaves a deployment undecided until it has been read", () => {
    const { result } = setup({ dseqs: ["1"], deployments: {} });

    expect(result.current).toEqual([{ dseq: "1", name: null, readiness: undefined }]);
  });

  it("settles a deployment the api refuses to read as unread rather than failed, as its other readers do, and leaves it undecided", async () => {
    const { result, queryClient } = setup({ dseqs: ["1"], deployments: {}, apiError: new ApiError(404, { message: "Not found" }, "GET → 404") });

    await vi.waitFor(() => expect(queryClient.getQueryCache().getAll()[0]?.state).toMatchObject({ status: "success", data: null }));
    expect(result.current).toEqual([{ dseq: "1", name: null, readiness: undefined }]);
  });

  it("checks again while a deployment spins up", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { getDeployment } = setup({ dseqs: ["1"], deployments: { "1": { name: null, ...deploymentWith([leaseReporting({ web: 0 })]) } } });
      await vi.waitFor(() => expect(getDeployment).toHaveBeenCalledTimes(1));

      await vi.advanceTimersByTimeAsync(10_000);

      expect(getDeployment).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads nothing while it is given no deployment", () => {
    const { result, getDeployment } = setup({ dseqs: [], deployments: {} });

    expect(result.current).toEqual([]);
    expect(getDeployment).not.toHaveBeenCalled();
  });

  function setup(input: { dseqs: string[]; deployments: Record<string, DeploymentState & { name: string | null }>; apiError?: Error }) {
    const getDeployment = vi.fn(({ dseq }: { dseq: string }) => {
      if (input.apiError) return Promise.reject(input.apiError);
      const deployment = input.deployments[dseq];
      return deployment ? Promise.resolve({ data: deployment }) : new Promise(() => {});
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = createProxy({ v1: { getDeployment } }) as unknown as ApiService;
    const services = { api } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    const { result } = setupQuery(() => useDeploymentsReadiness(input.dseqs, { useServices }), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return { result, getDeployment, queryClient };
  }
});

describe(readinessOf.name, () => {
  it("is undecided before the deployment has been read", () => {
    expect(readinessOf(undefined)).toBeUndefined();
  });

  it("calls a deployment that closed stopped, since it will never be ready", () => {
    expect(readinessOf(deploymentWith([leaseReporting({ web: 1 })], "closed"))).toBe("stopped");
  });

  it("calls a deployment whose lease does not exist yet starting", () => {
    expect(readinessOf(deploymentWith([]))).toBe("starting");
  });

  it("calls a deployment whose only lease has closed starting", () => {
    expect(readinessOf(deploymentWith([{ state: "closed", status: null }]))).toBe("starting");
  });

  it("calls a deployment ready once every service of every live lease has a ready replica", () => {
    expect(readinessOf(deploymentWith([leaseReporting({ web: 1, db: 2 }), leaseReporting({ worker: 1 }), { state: "closed", status: null }]))).toBe("ready");
  });

  it("calls a deployment starting while any one service has no ready replica", () => {
    expect(readinessOf(deploymentWith([leaseReporting({ web: 1, db: 0 }), leaseReporting({ worker: 1 })]))).toBe("starting");
  });

  it("calls a deployment starting while its provider reports no service yet", () => {
    expect(readinessOf(deploymentWith([leaseReporting({})]))).toBe("starting");
  });

  it("leaves a deployment undecided while a provider has not reported, since it may well be running", () => {
    expect(readinessOf(deploymentWith([leaseReporting({ web: 1 }), { state: "active", status: null }]))).toBeUndefined();
  });
});

function deploymentWith(leases: DeploymentState["leases"], state = "active"): DeploymentState {
  return { deployment: { state }, leases };
}

function leaseReporting(availableByService: Record<string, number>): DeploymentState["leases"][number] {
  return {
    state: "active",
    status: { services: Object.fromEntries(Object.entries(availableByService).map(([name, available]) => [name, { available }])) }
  };
}
