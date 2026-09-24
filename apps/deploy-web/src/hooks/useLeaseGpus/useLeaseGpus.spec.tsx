import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useLeaseGpus";
import { leaseGpuKeyOf, useLeaseGpus, withLeaseGpus } from "./useLeaseGpus";

import { act } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const PROVIDER = "akash1provider";
const DETECTED = {
  services: [{ service: "web", gpus: [{ vendor: "nvidia", model: "h100", displayName: "H100", memoryMb: 81559, interface: "sxm", count: 1 }] }],
  driverVersion: "550.54.15",
  detectedAt: "2026-09-21T10:00:00.000Z"
};
const OFFERED = {
  gpus: [{ vendor: "nvidia", model: "a100", displayName: "A100", ram: "80Gi", interface: "sxm", count: 8 }],
  recordedAt: "2026-09-21T09:00:00.000Z"
};

describe(useLeaseGpus.name, () => {
  it("keys what it read by the identity a chain lease and a console lease share", async () => {
    const { result } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }] });

    await vi.waitFor(() => expect(Object.keys(result.current.byLease)).toHaveLength(1));
    expect(result.current.byLease[`1/2/${PROVIDER}`]).toEqual({ detectedGpus: DETECTED });
  });

  it("holds what the lease's bid offered next to what the console read", async () => {
    const { result } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED, offeredGpus: OFFERED }] });

    await vi.waitFor(() => expect(Object.keys(result.current.byLease)).toHaveLength(1));
    expect(result.current.byLease[`1/2/${PROVIDER}`]).toEqual({ detectedGpus: DETECTED, offeredGpus: OFFERED });
  });

  it("holds an offer alone for a lease the console has not looked inside, without a blank reading beside it", async () => {
    const { result } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, offeredGpus: OFFERED }] });

    await vi.waitFor(() => expect(Object.keys(result.current.byLease)).toHaveLength(1));
    expect(result.current.byLease[`1/2/${PROVIDER}`]).toEqual({ offeredGpus: OFFERED });
    expect(result.current.byLease[`1/2/${PROVIDER}`]).not.toHaveProperty("detectedGpus");
  });

  it("asks for the deployment it was given", async () => {
    const { getDeployment } = setup({ leases: [] });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalledWith({ dseq: "12345" }));
  });

  it("keys only the leases the console recorded something for", async () => {
    const { result } = setup({
      leases: [{ id: { gseq: 1, oseq: 1, provider: PROVIDER } }, { id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }]
    });

    await vi.waitFor(() => expect(result.current.byLease[leaseGpuKeyOf({ gseq: 1, oseq: 2, provider: PROVIDER })]).toEqual({ detectedGpus: DETECTED }));
    expect(Object.keys(result.current.byLease)).toEqual([leaseGpuKeyOf({ gseq: 1, oseq: 2, provider: PROVIDER })]);
  });

  it("hands back the same readings on every render, so the lease views keyed on them keep their selection", async () => {
    const { result, rerender } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }] });
    await vi.waitFor(() => expect(Object.keys(result.current.byLease)).toHaveLength(1));
    const first = result.current.byLease;

    rerender();

    expect(result.current.byLease).toBe(first);
  });

  it("hands back the same readings after a refetch that changed nothing about them", async () => {
    const { result, rerender, queryClient, getDeployment } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }] });
    await vi.waitFor(() => expect(Object.keys(result.current.byLease)).toHaveLength(1));
    const first = result.current.byLease;

    await act(() => queryClient.refetchQueries());
    rerender();

    expect(getDeployment).toHaveBeenCalledTimes(2);
    expect(result.current.byLease).toBe(first);
  });

  it("holds nothing for a lease the console recorded nothing for", async () => {
    const { result, getDeployment } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER } }] });

    await vi.waitFor(() => expect(getDeployment).toHaveBeenCalled());
    expect(result.current.byLease).toEqual({});
  });

  it("holds nothing when the deployment is not one the caller can read", async () => {
    const { result } = setup({ apiError: new ApiError(404, {}, "not found") });

    await vi.waitFor(() => expect(result.current.byLease).toEqual({}));
  });

  it("reports loading until the deployment read answers", async () => {
    const { result } = setup({ leases: [{ id: { gseq: 1, oseq: 2, provider: PROVIDER }, detectedGpus: DETECTED }] });

    expect(result.current.isLoading).toBe(true);
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("asks for nothing without a dseq", () => {
    const { result, getDeployment } = setup({ dseq: null });

    expect(result.current).toEqual({ byLease: {}, isLoading: false });
    expect(getDeployment).not.toHaveBeenCalled();
  });

  function setup(input: {
    leases?: Array<{ id: { gseq: number; oseq: number; provider: string }; detectedGpus?: typeof DETECTED; offeredGpus?: typeof OFFERED }>;
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

    const { result, rerender } = setupQuery(() => useLeaseGpus(input.dseq === undefined ? "12345" : input.dseq, { useServices }), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return { result, rerender, getDeployment, queryClient };
  }
});

describe(withLeaseGpus.name, () => {
  it("joins what was recorded onto the lease it was recorded for", () => {
    const leases = [lease(1), lease(2)];

    const joined = withLeaseGpus(leases, { [leaseGpuKeyOf(leases[0])]: { detectedGpus: DETECTED, offeredGpus: OFFERED } });

    expect(joined?.[0].detectedGpus).toEqual(DETECTED);
    expect(joined?.[0].offeredGpus).toEqual(OFFERED);
    expect(joined?.[1]).toBe(leases[1]);
  });

  it("returns the leases untouched when nothing was recorded", () => {
    const leases = [lease(1)];

    expect(withLeaseGpus(leases, {})).toBe(leases);
  });

  it("carries an absent lease list through as it found it", () => {
    expect(withLeaseGpus(undefined, { "1/1/x": { detectedGpus: DETECTED } })).toBeUndefined();
    expect(withLeaseGpus(null, { "1/1/x": { detectedGpus: DETECTED } })).toBeNull();
  });

  function lease(gseq: number): LeaseDto {
    return mock<LeaseDto>({ gseq, oseq: 1, provider: PROVIDER });
  }
});
