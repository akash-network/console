import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useDetectedLeaseGpus";
import { leaseGpuKeyOf, useDetectedLeaseGpus, withDetectedGpus } from "./useDetectedLeaseGpus";

import { act } from "@testing-library/react";
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

    await vi.waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    expect(result.current[`1/2/${PROVIDER}`]).toEqual(DETECTED);
  });

  it("asks for the deployment it was given", async () => {
    const { getDeployment } = setup({ leases: [] });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalledWith({ dseq: "12345" }));
  });

  it("keys only the leases the console has looked inside", async () => {
    const { result } = setup({
      leases: [{ id: { gseq: 1, oseq: 1, provider: PROVIDER } }, { id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }]
    });

    await vi.waitFor(() => expect(result.current[leaseGpuKeyOf({ gseq: 1, oseq: 2, provider: PROVIDER })]).toEqual(DETECTED));
    expect(Object.keys(result.current)).toEqual([leaseGpuKeyOf({ gseq: 1, oseq: 2, provider: PROVIDER })]);
  });

  it("hands back the same readings on every render, so the lease views keyed on them keep their selection", async () => {
    const { result, rerender } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }] });
    await vi.waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it("hands back the same readings after a refetch that changed nothing about them", async () => {
    const { result, rerender, queryClient, getDeployment } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }] });
    await vi.waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    const first = result.current;

    await act(() => queryClient.refetchQueries());
    rerender();

    expect(getDeployment).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(first);
  });

  it("holds nothing for a lease the console has not looked inside", async () => {
    const { result, getDeployment } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER } }] });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalled());
    expect(result.current).toEqual({});
  });

  it("holds nothing when the deployment is not one the caller can read", async () => {
    const { result } = setup({ apiError: new ApiError(404, {}, "not found") });

    await vi.waitFor(() => expect(result.current).toEqual({}));
  });

  it("asks for nothing without a dseq", () => {
    const { result, getDeployment } = setup({ dseq: null });

    expect(result.current).toEqual({});
    expect(getDeployment).not.toHaveBeenCalled();
  });

  function setup(input: {
    leases?: Array<{ id: { gseq: number; oseq: number; provider: string }; detectedGpus?: typeof DETECTED }>;
    apiError?: Error;
    dseq?: string | null;
  }) {
    let escrowBalance = 0;
    const getDeployment = vi.fn(() => {
      if (input.apiError) return Promise.reject(input.apiError);
      escrowBalance += 1;
      return Promise.resolve({ data: { escrow_account: { balance: String(escrowBalance) }, leases: structuredClone(input.leases ?? []) } });
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = createProxy({ v1: { getDeployment } }) as unknown as ApiService;
    const services = { api } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    const { result, rerender } = setupQuery(() => useDetectedLeaseGpus(input.dseq === undefined ? "12345" : input.dseq, { useServices }), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return { result, rerender, getDeployment, queryClient };
  }
});

describe(withDetectedGpus.name, () => {
  it("joins what was read onto the lease it was read from", () => {
    const leases = [lease(1), lease(2)];

    const joined = withDetectedGpus(leases, { [leaseGpuKeyOf(leases[0])]: DETECTED });

    expect(joined?.[0].detectedGpus).toEqual(DETECTED);
    expect(joined?.[1]).toBe(leases[1]);
  });

  it("returns the leases untouched when nothing was read", () => {
    const leases = [lease(1)];

    expect(withDetectedGpus(leases, {})).toBe(leases);
  });

  it("carries an absent lease list through as it found it", () => {
    expect(withDetectedGpus(undefined, { "1/1/x": DETECTED })).toBeUndefined();
    expect(withDetectedGpus(null, { "1/1/x": DETECTED })).toBeNull();
  });

  function lease(gseq: number): LeaseDto {
    return mock<LeaseDto>({ gseq, oseq: 1, provider: PROVIDER });
  }
});
