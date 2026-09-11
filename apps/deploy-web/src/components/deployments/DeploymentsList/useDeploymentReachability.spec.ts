import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus, LeaseStatusDto } from "@src/queries/useLeaseQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import type { DEPENDENCIES } from "./useDeploymentReachability";
import { useDeploymentReachability } from "./useDeploymentReachability";

import { renderHook } from "@testing-library/react";

describe(useDeploymentReachability.name, () => {
  it("collects the endpoints exposed by every live lease", () => {
    const { result } = setup({
      leases: [lease({ state: "active" })],
      statuses: [{ services: { web: mock<LeaseServiceStatus>({ uris: ["acmecorp.com:443"] }) } }]
    });

    expect(result.current.endpoints).toEqual([{ serviceName: "web", host: "acmecorp.com", port: 443, href: "http://acmecorp.com:443" }]);
    expect(result.current.unreachableReason).toBeNull();
  });

  it("reports a deployment without a live lease as not running rather than private", () => {
    const { result } = setup({ leases: [lease({ state: "closed" })] });

    expect(result.current.unreachableReason).toBe("not-running");
  });

  it("reports a live lease whose status carries no endpoint as private", () => {
    const { result } = setup({ leases: [lease({ state: "active" })], statuses: [{ services: { worker: mock<LeaseServiceStatus>({ uris: [] }) } }] });

    expect(result.current.unreachableReason).toBe("no-public-endpoint");
  });

  it("reports an unreachable provider when no live lease returned a status", () => {
    const { result } = setup({ leases: [lease({ state: "active" })], statuses: [null] });

    expect(result.current.unreachableReason).toBe("provider-unreachable");
  });

  it("withholds a reason while a lease status is still pending", () => {
    const { result } = setup({ leases: [lease({ state: "active" })], statuses: [null], isStatusPending: true });

    expect(result.current.isLoadingEndpoints).toBe(true);
    expect(result.current.unreachableReason).toBeNull();
  });

  it("counts a lease in its reclamation grace period as live, since it is still serving", () => {
    const { result } = setup({
      leases: [lease({ state: "reclaiming" })],
      statuses: [{ services: { web: mock<LeaseServiceStatus>({ uris: ["still-up.example.com"] }) } }]
    });

    expect(result.current.endpoints).toHaveLength(1);
  });

  it("polls lease status so a card does not go stale while it is on screen", () => {
    const { useLeaseStatuses } = setup({ leases: [lease({ state: "active" })], statuses: [null] });

    expect(useLeaseStatuses).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ refetchInterval: 30_000 }));
  });

  function lease(input: Partial<LeaseDto>): LeaseDto {
    return mock<LeaseDto>({ dseq: "100", gseq: 1, oseq: 1, provider: "akash1provider", ...input });
  }

  function setup(input: { leases: LeaseDto[]; statuses?: (Partial<LeaseStatusDto> | null)[]; isStatusPending?: boolean; isLoadingLeases?: boolean }) {
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner" });

    const useDeploymentLeaseList = vi.fn<typeof DEPENDENCIES.useDeploymentLeaseList>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentLeaseList>>(), {
        data: input.leases,
        isLoading: input.isLoadingLeases ?? false
      })
    );

    const useLeaseStatuses = vi.fn<typeof DEPENDENCIES.useLeaseStatuses>(() =>
      (input.statuses ?? []).map(status =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLeaseStatuses>[number]>(), {
          data: status as LeaseStatusDto | null,
          isPending: input.isStatusPending ?? false
        })
      )
    );

    const providers = [mock<ApiProviderList>({ owner: "akash1provider", hostUri: "https://provider.example.com" })];
    const deployment = mock<DeploymentDto>({ dseq: "100", state: "active" });

    const hook = renderHook(() =>
      useDeploymentReachability({
        deployment,
        providers,
        dependencies: { useWallet, useDeploymentLeaseList, useLeaseStatuses }
      })
    );

    return { ...hook, useLeaseStatuses, useDeploymentLeaseList };
  }
});
