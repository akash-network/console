"use client";
import { useCallback, useMemo } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useDeploymentList, useDeploymentsPage } from "@src/queries/useDeploymentQuery";
import type { DeploymentDto, NamedDeploymentDto } from "@src/types/deployment";

export const DEPENDENCIES = {
  useWallet,
  useDeploymentNames,
  useDeploymentsPage,
  useDeploymentList
};

export interface DeploymentsListSourceInput {
  search: string;
  pageIndex: number;
  pageSize: number;
  archivePageIndex: number;
}

export interface DeploymentsListSlice {
  deployments: NamedDeploymentDto[];
  hasNextPage: boolean;
  /** Whether the paged query has ever answered, which is what the placeholders wait on. A search does not retract it. */
  isResolved: boolean;
  isFetching: boolean;
  isError: boolean;
}

export interface DeploymentsListArchiveSlice extends DeploymentsListSlice {
  /** Closed deployments matching the current search, or all of them when there is none. The count the Archive header shows. */
  total: number;
}

export interface DeploymentsListSource {
  active: DeploymentsListSlice;
  archive: DeploymentsListArchiveSlice;
  refetch: () => void;
}

/**
 * Active deployments are paged by the chain, but a search has to span the whole account, so it swaps the paged
 * query for the full list and pages that in memory. The archive is fetched whole for the same reason and because
 * the collapsed Archive section has to show a count before anyone opens it.
 */
export function useChainDeploymentsListSource(
  { search, pageIndex, pageSize, archivePageIndex }: DeploymentsListSourceInput,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): DeploymentsListSource {
  const d = dependencies;
  const { address } = d.useWallet();

  const isSearching = search.trim().length > 0;
  const canQuery = !!address;

  const activePage = d.useDeploymentsPage(address, { state: "active", skip: pageIndex * pageSize, limit: pageSize }, { enabled: canQuery && !isSearching });
  const activeList = d.useDeploymentList(address, { enabled: canQuery && isSearching }, "active");
  const archiveList = d.useDeploymentList(address, { enabled: canQuery }, "closed");

  const fetchedActiveDeployments = isSearching ? activeList.data : activePage.data?.deployments;
  const { getDeploymentName } = d.useDeploymentNames([...(fetchedActiveDeployments ?? []), ...(archiveList.data ?? [])].map(deployment => deployment.dseq));

  const activeDeployments = useMemo(
    () => resolveDeployments(fetchedActiveDeployments, getDeploymentName, search),
    [fetchedActiveDeployments, getDeploymentName, search]
  );

  const archiveDeployments = useMemo(() => resolveDeployments(archiveList.data, getDeploymentName, search), [archiveList.data, getDeploymentName, search]);

  const pageDeployments = useMemo(
    () => (isSearching ? activeDeployments.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize) : activeDeployments),
    [activeDeployments, isSearching, pageIndex, pageSize]
  );

  const archivePageDeployments = useMemo(
    () => archiveDeployments.slice(archivePageIndex * pageSize, archivePageIndex * pageSize + pageSize),
    [archiveDeployments, archivePageIndex, pageSize]
  );

  const refetchActive = isSearching ? activeList.refetch : activePage.refetch;
  const refetchArchive = archiveList.refetch;
  const refetch = useCallback(() => {
    refetchActive();
    refetchArchive();
  }, [refetchActive, refetchArchive]);

  return {
    active: {
      deployments: pageDeployments,
      hasNextPage: isSearching ? (pageIndex + 1) * pageSize < activeDeployments.length : activePage.data?.hasNextPage ?? false,
      isResolved: activePage.data !== undefined,
      isFetching: isSearching ? activeList.isFetching : activePage.isFetching,
      isError: isSearching ? activeList.isError : activePage.isError
    },
    archive: {
      deployments: archivePageDeployments,
      total: archiveDeployments.length,
      hasNextPage: (archivePageIndex + 1) * pageSize < archiveDeployments.length,
      isResolved: archiveList.data !== undefined,
      isFetching: archiveList.isFetching,
      isError: archiveList.isError
    },
    refetch
  };
}

/** Names come from the console rather than the chain, so search can only run once they are attached. */
function resolveDeployments(
  deployments: DeploymentDto[] | null | undefined,
  getDeploymentName: (dseq: string | number | null) => string | null,
  search: string
): NamedDeploymentDto[] {
  const named = (deployments ?? []).map(deployment => ({ ...deployment, name: getDeploymentName(deployment.dseq) }) as NamedDeploymentDto);
  const query = search.trim().toLowerCase();
  if (!query) return named;

  return named.filter(deployment => deployment.name?.toLowerCase().includes(query) || deployment.dseq?.toLowerCase().includes(query));
}
