"use client";
import { useCallback, useMemo } from "react";
import { differenceInHours } from "date-fns";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useProviderGpus } from "@src/queries/useGpuQuery";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import type { ProviderActiveLeasesGraph } from "@src/queries/useProvidersQuery";
import { useProviderActiveLeasesGraph, useProviderDetail, useProviderStatus } from "@src/queries/useProvidersQuery";
import type { ProviderGpuInventory } from "@src/types/gpu";
import type { ApiProviderDetail } from "@src/types/provider";

export type GpuModelAvailability = {
  vendor: string;
  model: string;
  ram: string;
  interface: string;
  total: number;
  free: number;
};

export type LeaseTrend = {
  current: number;
  changeOver30Days: number | null;
  series: number[];
};

/** A provider that answered in the last day is shown as active, so a brief outage doesn't flag it inactive. */
const RECENTLY_ONLINE_HOURS = 24;
const LEASE_TREND_DAYS = 90;
const LEASE_CHANGE_DAYS = 30;

export const DEPENDENCIES = {
  useProviderDetail,
  useProviderStatus,
  useProviderGpus,
  useProviderActiveLeasesGraph,
  useAllLeases,
  useWallet,
  useLocalNotes,
  useDeploymentNames
};

export function useProviderProfileModel(owner: string, initialProvider: ApiProviderDetail, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { data: providerDetail } = d.useProviderDetail(owner, { initialData: initialProvider });
  const provider = providerDetail ?? initialProvider;
  const { data: status } = d.useProviderStatus(provider, { retry: false });
  const { data: gpuInventory, isLoading: isLoadingGpus } = d.useProviderGpus(owner);
  const { data: activeLeasesGraph } = d.useProviderActiveLeasesGraph(owner);
  const { address } = d.useWallet();
  const { data: walletLeases } = d.useAllLeases(address, { state: "active", enabled: !!address });
  const { favoriteProviders, updateFavoriteProviders } = d.useLocalNotes();

  const myLeases = useMemo(() => walletLeases?.filter(lease => lease.provider === owner) ?? [], [walletLeases, owner]);
  const { getDeploymentName } = d.useDeploymentNames(myLeases.map(lease => lease.dseq));
  const isFavorite = favoriteProviders.includes(owner);

  const toggleFavorite = useCallback(() => {
    updateFavoriteProviders(isFavorite ? favoriteProviders.filter(favorite => favorite !== owner) : favoriteProviders.concat(owner));
  }, [isFavorite, favoriteProviders, updateFavoriteProviders, owner]);

  return {
    provider,
    isInactive: !isRecentlyOnline(provider),
    kubeVersion: status?.kube ? `${status.kube.major}.${status.kube.minor}` : null,
    gpuModels: useMemo(() => (gpuInventory ? listGpuModels(gpuInventory) : null), [gpuInventory]),
    isLoadingGpus,
    leaseTrend: useMemo(() => (activeLeasesGraph ? buildLeaseTrend(activeLeasesGraph) : null), [activeLeasesGraph]),
    myLeases,
    getDeploymentName,
    isFavorite,
    toggleFavorite
  };
}

function isRecentlyOnline(provider: ApiProviderDetail): boolean {
  if (provider.isOnline) return true;
  return !!provider.lastOnlineDate && differenceInHours(new Date(), new Date(provider.lastOnlineDate)) < RECENTLY_ONLINE_HOURS;
}

function listGpuModels(inventory: ProviderGpuInventory): GpuModelAvailability[] {
  return Object.entries(inventory.gpus.details).flatMap(([vendor, models]) =>
    models.map(gpu => ({
      vendor,
      model: gpu.model,
      ram: gpu.ram,
      interface: gpu.interface,
      total: gpu.allocatable,
      free: Math.max(0, gpu.allocatable - gpu.allocated)
    }))
  );
}

function buildLeaseTrend(graph: ProviderActiveLeasesGraph): LeaseTrend {
  const series = graph.snapshots.slice(-LEASE_TREND_DAYS).map(snapshot => snapshot.value);
  const monthAgo = graph.snapshots.at(-(LEASE_CHANGE_DAYS + 1));

  return {
    current: graph.currentValue,
    changeOver30Days: monthAgo ? graph.currentValue - monthAgo.value : null,
    series
  };
}
