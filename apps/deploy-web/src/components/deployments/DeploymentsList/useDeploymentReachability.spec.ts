import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus, LeaseStatusDto } from "@src/queries/useLeaseQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import type { DEPENDENCIES } from "./useDeploymentReachability";
import { useDeploymentReachability } from "./useDeploymentReachability";

import { act, renderHook } from "@testing-library/react";

describe(useDeploymentReachability.name, () => {
  it("collects the endpoints exposed by every live lease", () => {
    const { result } = setup({
      leases: [lease({ state: "active" })],
      statuses: [{ services: { web: mock<LeaseServiceStatus>({ uris: ["acmecorp.com:443"] }) } }]
    });

    expect(result.current.endpoints).toEqual([{ serviceName: "web", host: "acmecorp.com", port: 443, href: "http://acmecorp.com:443" }]);
    expect(result.current.unreachableReason).toBeNull();
  });

  it("hands the deployment's leases back for the status badge to speak for", () => {
    const leases = [lease({ state: "active" })];
    const { result } = setup({ leases, statuses: [null] });

    expect(result.current.leases).toBe(leases);
  });

  it("waits for an address before asking the chain for leases", () => {
    const { useDeploymentLeaseList } = setup({ leases: [], address: "" });

    expect(useDeploymentLeaseList).toHaveBeenCalledWith("", expect.anything(), { enabled: false });
  });

  it("asks for leases once an address is known", () => {
    const { useDeploymentLeaseList } = setup({ leases: [] });

    expect(useDeploymentLeaseList).toHaveBeenCalledWith("akash1owner", expect.anything(), { enabled: true });
  });

  it("reports loading while the leases themselves are still arriving", () => {
    const { result } = setup({ leases: [], isLoadingLeases: true });

    expect(result.current.isLoadingLeases).toBe(true);
    expect(result.current.isLoadingEndpoints).toBe(true);
    expect(result.current.unreachableReason).toBeNull();
  });

  describe("choosing the provider to ask", () => {
    it("pairs each live lease with the provider that owns it", () => {
      const { useLeaseStatuses, provider } = setup({ leases: [lease({ state: "active", provider: "akash1provider" })], statuses: [null] });

      expect(useLeaseStatuses).toHaveBeenCalledWith([expect.objectContaining({ provider })], expect.anything());
    });

    it("leaves the provider undefined when the lease's provider is not in the list", () => {
      const { useLeaseStatuses } = setup({ leases: [lease({ state: "active", provider: "akash1stranger" })], statuses: [null] });

      expect(useLeaseStatuses).toHaveBeenCalledWith([expect.objectContaining({ provider: undefined })], expect.anything());
    });

    it("leaves the provider undefined when the provider list has not loaded", () => {
      const { useLeaseStatuses } = setup({ leases: [lease({ state: "active" })], statuses: [null], providers: undefined });

      expect(useLeaseStatuses).toHaveBeenCalledWith([expect.objectContaining({ provider: undefined })], expect.anything());
    });

    it("asks nothing for a lease that is no longer live", () => {
      const { useLeaseStatuses } = setup({ leases: [lease({ state: "closed" })] });

      expect(useLeaseStatuses).toHaveBeenCalledWith([], expect.anything());
    });

    it("polls lease status so a card does not go stale while it is on screen", () => {
      const { useLeaseStatuses } = setup({ leases: [lease({ state: "active" })], statuses: [null] });

      expect(useLeaseStatuses).toHaveBeenCalledWith(expect.anything(), { refetchInterval: 30_000 });
    });

    it("re-pairs the leases when the provider list arrives late", () => {
      const { useLeaseStatuses, rerenderWith, provider } = setup({ leases: [lease({ state: "active" })], statuses: [null], providers: undefined });

      expect(useLeaseStatuses).toHaveBeenLastCalledWith([expect.objectContaining({ provider: undefined })], expect.anything());

      rerenderWith({ providers: "load" });

      expect(useLeaseStatuses).toHaveBeenLastCalledWith([expect.objectContaining({ provider })], expect.anything());
    });
  });

  describe("why there is nothing to reach", () => {
    it("reports a deployment without a live lease as not running rather than private", () => {
      const { result } = setup({ leases: [lease({ state: "closed" })] });

      expect(result.current.unreachableReason).toBe("not-running");
    });

    it("reports a deployment with no leases at all as not running", () => {
      const { result } = setup({ leases: [] });

      expect(result.current.unreachableReason).toBe("not-running");
    });

    it("reports a live lease whose status carries no endpoint as private", () => {
      const { result } = setup({ leases: [lease({ state: "active" })], statuses: [{ services: { worker: mock<LeaseServiceStatus>({ uris: [] }) } }] });

      expect(result.current.unreachableReason).toBe("no-public-endpoint");
    });

    it("reports an unreachable provider only when no live lease returned a status at all", () => {
      const { result } = setup({ leases: [lease({ state: "active" }), lease({ state: "active", gseq: 2 })], statuses: [null, null] });

      expect(result.current.unreachableReason).toBe("provider-unreachable");
    });

    it("prefers the private reading when at least one provider did answer", () => {
      const { result } = setup({
        leases: [lease({ state: "active" }), lease({ state: "active", gseq: 2 })],
        statuses: [null, { services: { worker: mock<LeaseServiceStatus>({ uris: [] }) } }]
      });

      expect(result.current.unreachableReason).toBe("no-public-endpoint");
    });

    it("gives no reason at all while a lease status is still pending", () => {
      const { result } = setup({ leases: [lease({ state: "active" })], statuses: [null], isStatusPending: true });

      expect(result.current.isLoadingEndpoints).toBe(true);
      expect(result.current.unreachableReason).toBeNull();
    });

    it("gives no reason while endpoints exist", () => {
      const { result } = setup({
        leases: [lease({ state: "active" })],
        statuses: [{ services: { web: mock<LeaseServiceStatus>({ uris: ["up.example.com"] }) } }]
      });

      expect(result.current.unreachableReason).toBeNull();
    });

    it("counts a lease in its reclamation grace period as live, since it is still serving", () => {
      const { result } = setup({
        leases: [lease({ state: "reclaiming" })],
        statuses: [{ services: { web: mock<LeaseServiceStatus>({ uris: ["still-up.example.com"] }) } }]
      });

      expect(result.current.endpoints).toHaveLength(1);
      expect(result.current.unreachableReason).toBeNull();
    });
  });

  describe("when a lease status never settles", () => {
    it("stops waiting and commits to a reason rather than spinning forever", () => {
      vi.useFakeTimers();
      try {
        const { result } = setup({ leases: [lease({ state: "active" })], statuses: [null], isStatusPending: true });

        expect(result.current.isLoadingEndpoints).toBe(true);

        act(() => vi.advanceTimersByTime(15_000));

        expect(result.current.isLoadingEndpoints).toBe(false);
        expect(result.current.unreachableReason).toBe("provider-unreachable");
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps waiting right up to the deadline", () => {
      vi.useFakeTimers();
      try {
        const { result } = setup({ leases: [lease({ state: "active" })], statuses: [null], isStatusPending: true });

        act(() => vi.advanceTimersByTime(14_999));

        expect(result.current.isLoadingEndpoints).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("drops its timer when the card leaves the screen", () => {
      vi.useFakeTimers();
      try {
        const { unmount } = setup({ leases: [lease({ state: "active" })], statuses: [null], isStatusPending: true });

        unmount();

        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  function lease(input: Partial<LeaseDto>): LeaseDto {
    return mock<LeaseDto>({ dseq: "100", gseq: 1, oseq: 1, provider: "akash1provider", ...input });
  }

  type Input = {
    leases: LeaseDto[];
    statuses?: (Partial<LeaseStatusDto> | null)[];
    isStatusPending?: boolean;
    isLoadingLeases?: boolean;
    address?: string;
    providers?: ApiProviderList[] | undefined | "load";
  };

  function setup(input: Input) {
    let current = input;
    const provider = mock<ApiProviderList>({ owner: "akash1provider", hostUri: "https://provider.example.com" });
    const providerList = [provider];

    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: current.address ?? "akash1owner" });

    const useDeploymentLeaseList = vi.fn<typeof DEPENDENCIES.useDeploymentLeaseList>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentLeaseList>>(), {
        data: current.leases,
        isLoading: current.isLoadingLeases ?? false
      })
    );

    const useLeaseStatuses = vi.fn<typeof DEPENDENCIES.useLeaseStatuses>(() =>
      (current.statuses ?? []).map(status =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLeaseStatuses>[number]>(), {
          data: status as LeaseStatusDto | null,
          isPending: current.isStatusPending ?? false
        })
      )
    );

    const deployment = mock<DeploymentDto>({ dseq: "100", state: "active" });
    const resolveProviders = () => ("providers" in current ? (current.providers === "load" ? providerList : current.providers) : providerList);

    const hook = renderHook(() =>
      useDeploymentReachability({
        deployment,
        providers: resolveProviders() as ApiProviderList[] | undefined,
        dependencies: { useWallet, useDeploymentLeaseList, useLeaseStatuses }
      })
    );

    return {
      ...hook,
      rerenderWith(next: Partial<Input>) {
        current = { ...current, ...next };
        hook.rerender();
      },
      provider,
      useLeaseStatuses,
      useDeploymentLeaseList
    };
  }
});
