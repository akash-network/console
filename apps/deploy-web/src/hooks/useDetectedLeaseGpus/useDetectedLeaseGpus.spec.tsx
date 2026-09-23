import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useDetectedLeaseGpus";
import { leaseGpuKeyOf, useDetectedLeaseGpus, withDetectedGpus } from "./useDetectedLeaseGpus";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const PROVIDER = "akash1provider";
const DETECTED = {
  services: [{ service: "web", gpus: [{ vendor: "nvidia", model: "h100", displayName: "H100", memoryMb: 81559, interface: "sxm", count: 1 }] }],
  driverVersion: "550.54.15",
  detectedAt: "2026-09-21T10:00:00.000Z"
};

describe(useDetectedLeaseGpus.name, () => {
  it("keys what it read by the identity a chain lease and a console lease share", async () => {
    const { result } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }] });

    await vi.waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.get(`1/2/${PROVIDER}`)).toEqual(DETECTED);
  });

  it("hands back the same map on every render until the deployment changes, so the lease views keyed on it keep their selection", async () => {
    const { result, rerender } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }] });
    await vi.waitFor(() => expect(result.current.size).toBe(1));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it("holds nothing for a lease the console has not looked inside", async () => {
    const { result, getDeployment } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER } }] });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });

  it("holds nothing when the deployment is not one the caller can read", async () => {
    const { result } = setup({ apiError: new ApiError({} as never, { status: 404 } as never, "not found") });

    await vi.waitFor(() => expect(result.current.size).toBe(0));
  });

  it("asks for nothing without a dseq", () => {
    const { result, getDeployment } = setup({ dseq: null });

    expect(result.current.size).toBe(0);
    expect(getDeployment).not.toHaveBeenCalled();
  });

  function setup(input: {
    leases?: Array<{ id: { gseq: number; oseq: number; provider: string }; detectedGpus?: typeof DETECTED }>;
    apiError?: Error;
    dseq?: string | null;
  }) {
    const getDeployment = vi.fn(() => {
      if (input.apiError) return Promise.reject(input.apiError);
      return Promise.resolve({ data: { leases: input.leases ?? [] } });
    });
    const api = createProxy({ v1: { getDeployment } }) as unknown as ApiService;
    const services = { api } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    const { result, rerender } = setupQuery(() => useDetectedLeaseGpus(input.dseq === undefined ? "12345" : input.dseq, { useServices }), {
      services: { api: () => api }
    });

    return { result, rerender, getDeployment };
  }
});

describe(withDetectedGpus.name, () => {
  it("joins what was read onto the lease it was read from", () => {
    const leases = [lease(1), lease(2)];

    const joined = withDetectedGpus(leases, new Map([[leaseGpuKeyOf(leases[0]), DETECTED]]));

    expect(joined?.[0].detectedGpus).toEqual(DETECTED);
    expect(joined?.[1]).toBe(leases[1]);
  });

  it("returns the leases untouched when nothing was read", () => {
    const leases = [lease(1)];

    expect(withDetectedGpus(leases, new Map())).toBe(leases);
  });

  it("carries an absent lease list through as it found it", () => {
    expect(withDetectedGpus(undefined, new Map([["1/1/x", DETECTED]]))).toBeUndefined();
    expect(withDetectedGpus(null, new Map([["1/1/x", DETECTED]]))).toBeNull();
  });

  function lease(gseq: number): LeaseDto {
    return mock<LeaseDto>({ gseq, oseq: 1, provider: PROVIDER });
  }
});
