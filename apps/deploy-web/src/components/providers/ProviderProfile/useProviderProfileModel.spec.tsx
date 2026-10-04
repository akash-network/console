import { subHours } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderActiveLeasesGraph } from "@src/queries/useProvidersQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ProviderGpuInventory } from "@src/types/gpu";
import type { ApiProviderDetail, ProviderStatusDto } from "@src/types/provider";
import type { DEPENDENCIES } from "./useProviderProfileModel";
import { useProviderProfileModel } from "./useProviderProfileModel";

import { act, renderHook } from "@testing-library/react";

describe(useProviderProfileModel.name, () => {
  it("shows the provider the page loaded with until the fresh copy arrives", () => {
    const initialProvider = createProvider({ owner: "akash1provider" });
    const { result, useProviderDetail } = setup({ initialProvider });

    expect(result.current.provider).toBe(initialProvider);
    expect(useProviderDetail).toHaveBeenCalledWith("akash1provider", { initialData: initialProvider });
  });

  it("shows the fresh copy once it arrives", () => {
    const freshProvider = createProvider({ owner: "akash1provider", leaseCount: 9 });
    const { result } = setup({ freshProvider });

    expect(result.current.provider).toBe(freshProvider);
  });

  it("treats an online provider as active", () => {
    const { result } = setup({ initialProvider: createProvider({ isOnline: true, lastOnlineDate: null }) });

    expect(result.current.isInactive).toBe(false);
  });

  it("treats a provider that answered within the last day as active", () => {
    const { result } = setup({ initialProvider: createProvider({ isOnline: false, lastOnlineDate: subHours(new Date(), 23).toISOString() }) });

    expect(result.current.isInactive).toBe(false);
  });

  it("treats a provider silent for a day or more as inactive", () => {
    const { result } = setup({ initialProvider: createProvider({ isOnline: false, lastOnlineDate: subHours(new Date(), 24).toISOString() }) });

    expect(result.current.isInactive).toBe(true);
  });

  it("treats a provider that never answered as inactive", () => {
    const { result } = setup({ initialProvider: createProvider({ isOnline: false, lastOnlineDate: null }) });

    expect(result.current.isInactive).toBe(true);
  });

  it("reads the Kubernetes version from the provider's status", () => {
    const { result } = setup({ status: mock<ProviderStatusDto>({ kube: mock<ProviderStatusDto["kube"]>({ major: "1", minor: "32" }) }) });

    expect(result.current.kubeVersion).toBe("1.32");
  });

  it("has no Kubernetes version while the provider's status is unknown", () => {
    const { result } = setup({ status: undefined });

    expect(result.current.kubeVersion).toBeNull();
  });

  it("lists each GPU model with how many are free", () => {
    const { result } = setup({
      gpuInventory: {
        gpus: {
          total: { allocatable: 10, allocated: 7 },
          details: {
            nvidia: [
              { model: "h100", ram: "80Gi", interface: "SXM", allocatable: 8, allocated: 5 },
              { model: "t4", ram: "16Gi", interface: "PCIe", allocatable: 2, allocated: 3 }
            ]
          }
        }
      }
    });

    expect(result.current.gpuModels).toEqual([
      { vendor: "nvidia", model: "h100", ram: "80Gi", interface: "SXM", total: 8, free: 3 },
      { vendor: "nvidia", model: "t4", ram: "16Gi", interface: "PCIe", total: 2, free: 0 }
    ]);
  });

  it("has no GPU list until the inventory loads", () => {
    const { result } = setup({ gpuInventory: undefined, isLoadingGpus: true });

    expect(result.current).toMatchObject({ gpuModels: null, isLoadingGpus: true });
  });

  it("summarizes the last 90 days of active leases and the change over 30 days", () => {
    const snapshots = Array.from({ length: 100 }, (_, day) => ({ date: `day-${day}`, value: day }));
    const { result } = setup({ activeLeasesGraph: { currentValue: 99, compareValue: 98, snapshots } });

    expect(result.current.leaseTrend).toEqual({ current: 99, changeOver30Days: 30, series: snapshots.slice(-90).map(snapshot => snapshot.value) });
  });

  it("leaves the 30-day change out when the history is shorter", () => {
    const snapshots = [
      { date: "day-0", value: 3 },
      { date: "day-1", value: 5 }
    ];
    const { result } = setup({ activeLeasesGraph: { currentValue: 5, compareValue: 3, snapshots } });

    expect(result.current.leaseTrend).toEqual({ current: 5, changeOver30Days: null, series: [3, 5] });
  });

  it("has no lease trend while its history loads", () => {
    const { result } = setup({ activeLeasesGraph: undefined });

    expect(result.current.leaseTrend).toBeNull();
  });

  it("lists the wallet's active leases with this provider and names their deployments", () => {
    const leases = [
      createLease({ dseq: "1", provider: "akash1provider" }),
      createLease({ dseq: "2", provider: "akash1other" }),
      createLease({ dseq: "3", provider: "akash1provider" })
    ];
    const { result, useAllLeases, useDeploymentNames } = setup({ address: "akash1wallet", leases });

    expect(result.current.myLeases.map(lease => lease.dseq)).toEqual(["1", "3"]);
    expect(result.current.getDeploymentName("1")).toBe("deployment-1");
    expect(useAllLeases).toHaveBeenCalledWith("akash1wallet", { state: "active", enabled: true });
    expect(useDeploymentNames).toHaveBeenLastCalledWith(["1", "3"]);
  });

  it("asks for no leases without a wallet", () => {
    const { result, useAllLeases } = setup({ address: "", leases: undefined });

    expect(result.current.myLeases).toEqual([]);
    expect(useAllLeases).toHaveBeenCalledWith("", { state: "active", enabled: false });
  });

  it("adds the provider to the favorites and removes it again", () => {
    const { result, updateFavoriteProviders } = setup({ favoriteProviders: ["akash1kept"] });

    expect(result.current.isFavorite).toBe(false);
    act(() => result.current.toggleFavorite());
    expect(updateFavoriteProviders).toHaveBeenLastCalledWith(["akash1kept", "akash1provider"]);
  });

  it("removes a favorite provider from the favorites", () => {
    const { result, updateFavoriteProviders } = setup({ favoriteProviders: ["akash1kept", "akash1provider"] });

    expect(result.current.isFavorite).toBe(true);
    act(() => result.current.toggleFavorite());
    expect(updateFavoriteProviders).toHaveBeenLastCalledWith(["akash1kept"]);
  });

  function createProvider(overrides: Partial<ApiProviderDetail> = {}): ApiProviderDetail {
    return Object.assign(mock<ApiProviderDetail>(), { owner: "akash1provider", isOnline: true, lastOnlineDate: null, ...overrides });
  }

  function createLease(overrides: Partial<LeaseDto>): LeaseDto {
    return Object.assign(mock<LeaseDto>(), overrides);
  }

  function setup(
    input: {
      initialProvider?: ApiProviderDetail;
      freshProvider?: ApiProviderDetail;
      status?: ProviderStatusDto;
      gpuInventory?: ProviderGpuInventory;
      isLoadingGpus?: boolean;
      activeLeasesGraph?: ProviderActiveLeasesGraph;
      address?: string;
      leases?: LeaseDto[];
      favoriteProviders?: string[];
    } = {}
  ) {
    const initialProvider = input.initialProvider ?? createProvider();
    const updateFavoriteProviders = vi.fn();
    const providerDetail = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderDetail>>(), { data: input.freshProvider });
    const providerStatus = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderStatus>>(), { data: "status" in input ? input.status : undefined });
    const providerGpus = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderGpus>>(), {
      data: input.gpuInventory,
      isLoading: !!input.isLoadingGpus
    });
    const leasesGraph = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderActiveLeasesGraph>>(), { data: input.activeLeasesGraph });
    const allLeases = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAllLeases>>(), { data: input.leases });
    const wallet = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWallet>>(), { address: input.address ?? "akash1wallet" });
    const localNotes = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>(), {
      favoriteProviders: input.favoriteProviders ?? [],
      updateFavoriteProviders
    });
    const deploymentNames = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>(), {
      getDeploymentName: (dseq: string) => `deployment-${dseq}`
    });
    const useProviderDetail = vi.fn(() => providerDetail);
    const useAllLeases = vi.fn(() => allLeases);
    const useDeploymentNames = vi.fn(() => deploymentNames);

    const dependencies: typeof DEPENDENCIES = {
      useProviderDetail,
      useProviderStatus: () => providerStatus,
      useProviderGpus: () => providerGpus,
      useProviderActiveLeasesGraph: () => leasesGraph,
      useAllLeases,
      useWallet: () => wallet,
      useLocalNotes: () => localNotes,
      useDeploymentNames
    };

    const view = renderHook(() => useProviderProfileModel("akash1provider", initialProvider, dependencies));

    return { ...view, useProviderDetail, useAllLeases, useDeploymentNames, updateFavoriteProviders };
  }
});
