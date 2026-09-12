"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useWallet } from "@src/context/WalletProvider";
import { useListSelection } from "@src/hooks/useListSelection/useListSelection";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useDeploymentList, useDeploymentsPage } from "@src/queries/useDeploymentQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import { deploymentsViewModeAtom } from "@src/store/deploymentsViewStore";
import sdlStore from "@src/store/sdlStore";
import type { DeploymentDto, NamedDeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

export const DEPENDENCIES = {
  useWallet,
  useProviderList,
  useLocalNotes,
  useManagedDeploymentConfirm,
  useDeploymentsPage,
  useDeploymentList,
  useListSelection
};

export const DEFAULT_PAGE_SIZE = 12;

/**
 * Active deployments are paged server-side, but a search has to span the whole account, so it swaps the paged
 * query for the full list and pages that in memory. The archive is always fetched whole: the chain API reports
 * no total, and the collapsed Archive section has to show a count before anyone opens it.
 */
export function useDeploymentsListModel(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { address, signAndBroadcastTx, hasWallet } = d.useWallet();
  const { data: providers, isFetching: isLoadingProviders } = d.useProviderList();
  const { getDeploymentName } = d.useLocalNotes();
  const { closeDeploymentConfirm } = d.useManagedDeploymentConfirm();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const [viewMode, setViewMode] = useAtom(deploymentsViewModeAtom);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");

  const isSearching = search.trim().length > 0;
  const canQuery = !!address;

  const activePage = d.useDeploymentsPage(address, { state: "active", skip: pageIndex * pageSize, limit: pageSize }, { enabled: canQuery && !isSearching });
  const activeList = d.useDeploymentList(address, { enabled: canQuery && isSearching }, "active");
  const archiveList = d.useDeploymentList(address, { enabled: canQuery }, "closed");

  const activeDeployments = useMemo(
    () => resolveDeployments(isSearching ? activeList.data : activePage.data?.deployments, getDeploymentName, search),
    [isSearching, activeList.data, activePage.data?.deployments, getDeploymentName, search]
  );

  const archiveDeployments = useMemo(() => resolveDeployments(archiveList.data, getDeploymentName, search), [archiveList.data, getDeploymentName, search]);

  const pageDeployments = useMemo(
    () => (isSearching ? activeDeployments.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize) : activeDeployments),
    [activeDeployments, isSearching, pageIndex, pageSize]
  );

  const isLoadingDeployments = isSearching ? activeList.isFetching : activePage.isFetching;
  const isError = isSearching ? activeList.isError : activePage.isError;
  const isArchiveError = archiveList.isError;

  const refetchActive = isSearching ? activeList.refetch : activePage.refetch;
  const refetchArchive = archiveList.refetch;
  const refetchDeployments = useCallback(() => {
    refetchActive();
    refetchArchive();
  }, [refetchActive, refetchArchive]);

  const hasPageResults = pageDeployments.length > 0;
  const hasNextPage = isSearching ? (pageIndex + 1) * pageSize < activeDeployments.length : activePage.data?.hasNextPage ?? false;

  useEffect(
    function goBackFromEmptyPage() {
      if (pageIndex > 0 && !isLoadingDeployments && !isError && pageDeployments.length === 0) {
        setPageIndex(current => Math.max(current - 1, 0));
      }
    },
    [isLoadingDeployments, isError, pageIndex, pageDeployments.length]
  );

  const dseqs = useMemo(() => pageDeployments.map(deployment => deployment.dseq), [pageDeployments]);
  const { selectedItemIds, selectItem, clearSelection } = d.useListSelection<string>({ ids: dseqs });

  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setPageIndex(0);
  }, []);

  const changePageSize = useCallback((value: number) => {
    setPageSize(value);
    setPageIndex(0);
  }, []);

  const goToPreviousPage = useCallback(() => setPageIndex(current => Math.max(current - 1, 0)), []);
  const goToNextPage = useCallback(() => setPageIndex(current => current + 1), []);

  const changeViewMode = useCallback(
    (value: string) => {
      if (isViewMode(value)) setViewMode(value);
    },
    [setViewMode]
  );

  const closeSelectedDeployments = useCallback(async () => {
    if (!(await closeDeploymentConfirm(selectedItemIds))) return;

    const messages = selectedItemIds.map(dseq => TransactionMessageData.getCloseDeploymentMsg(address, `${dseq}`));
    const response = await signAndBroadcastTx(messages);
    if (!response) return;

    refetchDeployments();
    clearSelection();
  }, [closeDeploymentConfirm, selectedItemIds, address, signAndBroadcastTx, refetchDeployments, clearSelection]);

  const startNewDeployment = useCallback(() => setDeploySdl(null), [setDeploySdl]);

  return {
    hasWallet,
    providers,
    viewMode,
    changeViewMode,
    search,
    isSearching,
    changeSearch,
    pageDeployments,
    archiveDeployments,
    isLoadingDeployments,
    isLoadingProviders,
    isError,
    refetchDeployments,
    hasPageResults,
    hasAnyDeployment: hasPageResults || pageIndex > 0 || archiveDeployments.length > 0,
    hasSettledWithoutActiveDeployments:
      !hasPageResults && pageIndex === 0 && !isLoadingDeployments && !isError && !isArchiveError && !isSearching && !archiveList.isFetching,
    showErrorState: isError && !hasPageResults && !isLoadingDeployments,
    showArchiveError: isArchiveError && !archiveList.isFetching,
    showNoSearchResults:
      isSearching && !isError && !isArchiveError && !isLoadingDeployments && !archiveList.isFetching && !hasPageResults && archiveDeployments.length === 0,
    pageIndex,
    pageSize,
    changePageSize,
    goToPreviousPage,
    goToNextPage,
    hasNextPage,
    selectedItemIds,
    selectItem,
    clearSelection,
    closeSelectedDeployments,
    startNewDeployment
  };
}

function isViewMode(value: string): value is DeploymentsViewMode {
  return value === "grid" || value === "list";
}

/** Names come from this browser rather than the chain, so search can only run once they are attached. */
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
