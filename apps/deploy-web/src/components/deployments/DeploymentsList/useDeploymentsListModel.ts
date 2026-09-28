"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MIN_PAGE_SIZE } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useListSelection } from "@src/hooks/useListSelection/useListSelection";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useProvidersByAddresses } from "@src/queries/useProvidersQuery";
import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import { deploymentsViewModeAtom } from "@src/store/deploymentsViewStore";
import sdlStore from "@src/store/sdlStore";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { useApiDeploymentsListSource } from "./useApiDeploymentsListSource";

export const DEPENDENCIES = {
  useWallet,
  useProvidersByAddresses,
  useManagedDeploymentConfirm,
  useListSelection,
  useDeploymentsListSource: useApiDeploymentsListSource
};

/** Must stay one of the sizes PaginationSizeSelector offers, or the selector renders blank. */
export const DEFAULT_PAGE_SIZE = MIN_PAGE_SIZE;

/** Owns what the page does with a list of deployments, never where that list comes from. */
export function useDeploymentsListModel(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { analyticsService } = useServices();
  const { address, signAndBroadcastTx, hasWallet } = d.useWallet();
  const { closeDeploymentConfirm } = d.useManagedDeploymentConfirm();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const [viewMode, setViewMode] = useAtom(deploymentsViewModeAtom);

  const [pageIndex, setPageIndex] = useState(0);
  const [archivePageIndex, setArchivePageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");

  const { appliedSearch, active, archive, refetch: refetchDeployments } = d.useDeploymentsListSource({ search, pageIndex, pageSize, archivePageIndex });

  /** Reads the search the rows were fetched with rather than the box, so a paced source cannot report a search its rows have yet to reflect. */
  const isSearching = appliedSearch.length > 0;

  const pageDeployments = active.deployments;
  const liveLeaseProviderAddresses = useMemo(
    () => pageDeployments.flatMap(deployment => (deployment.leases ?? []).filter(isLeaseLive).map(lease => lease.provider)),
    [pageDeployments]
  );
  const { data: providers, isFetching: isLoadingProviders } = d.useProvidersByAddresses(liveLeaseProviderAddresses);
  const archivePageDeployments = archive.deployments;
  const archiveTotal = archive.total;

  const isLoadingDeployments = active.isFetching;
  const isError = active.isError;
  const isArchiveError = archive.isError;
  const isSearchTooBroad = active.isSearchTooBroad || archive.isSearchTooBroad;

  const hasPageResults = pageDeployments.length > 0;
  /** The count is unknown when the api could not answer it, so the rows it did return stand in for it. */
  const hasAnyArchived = archivePageDeployments.length > 0 || (archiveTotal ?? 0) > 0;
  /** A search is only reachable from a list that already had rows, so it stands in for the unfiltered counts the source no longer holds. */
  const hasAnyDeployment = isSearching || pageIndex > 0 || hasPageResults || hasAnyArchived;
  const hasNextPage = active.hasNextPage;
  const isPaginated = hasNextPage || pageIndex > 0;
  const hasNextArchivePage = archive.hasNextPage;
  const isArchivePaginated = hasNextArchivePage || archivePageIndex > 0;
  /** Both queries feed the choice between rows and the empty state, so neither can be decided until both have data. */
  const hasResolvedActiveAndArchive = active.isResolved && archive.isResolved;
  const isInitialLoad = !!address && !hasPageResults && !isError && !isArchiveError && !hasResolvedActiveAndArchive;
  const hasSettledWithoutActiveDeployments = !hasPageResults && pageIndex === 0 && !isError && !isArchiveError && !isSearching && hasResolvedActiveAndArchive;

  useEffect(
    function goBackFromEmptyPage() {
      if (pageIndex > 0 && !isLoadingDeployments && !isError && pageDeployments.length === 0) {
        setPageIndex(current => Math.max(current - 1, 0));
      }
    },
    [isLoadingDeployments, isError, pageIndex, pageDeployments.length]
  );

  useEffect(
    function goBackFromEmptyArchivePage() {
      if (archivePageIndex > 0 && !archive.isFetching && archivePageDeployments.length === 0) {
        setArchivePageIndex(current => Math.max(current - 1, 0));
      }
    },
    [archive.isFetching, archivePageIndex, archivePageDeployments.length]
  );

  const dseqs = useMemo(() => pageDeployments.map(deployment => deployment.dseq), [pageDeployments]);
  const { selectedItemIds, selectItem, clearSelection } = d.useListSelection<string>({ ids: dseqs });

  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setPageIndex(0);
    setArchivePageIndex(0);
  }, []);

  const changePageSize = useCallback((value: number) => {
    setPageSize(value);
    setPageIndex(0);
    setArchivePageIndex(0);
  }, []);

  const goToPreviousPage = useCallback(() => setPageIndex(current => Math.max(current - 1, 0)), []);
  const goToNextPage = useCallback(() => setPageIndex(current => current + 1), []);
  const goToPreviousArchivePage = useCallback(() => setArchivePageIndex(current => Math.max(current - 1, 0)), []);
  const goToNextArchivePage = useCallback(() => setArchivePageIndex(current => current + 1), []);

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
    analyticsService.track("close_deployment", { category: "deployments", label: "Close selected deployments from list", count: selectedItemIds.length });
  }, [closeDeploymentConfirm, selectedItemIds, address, signAndBroadcastTx, refetchDeployments, clearSelection, analyticsService]);

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
    archiveTotal,
    hasAnyArchived,
    archivePageDeployments,
    isLoadingDeployments,
    isLoadingProviders,
    isError,
    refetchDeployments,
    hasPageResults,
    hasAnyDeployment,
    hasSettledWithoutActiveDeployments,
    /** The empty state carries its own deploy button, so the header link stands in for it everywhere else, including when the archive is the only query that failed. */
    showNewDeploymentLink: !isInitialLoad && !hasSettledWithoutActiveDeployments,
    showErrorState: isError && !hasPageResults && !isLoadingDeployments,
    showArchiveError: isArchiveError,
    isRetryingArchive: isArchiveError && archive.isFetching,
    showSearchTooBroad: active.isSearchTooBroad,
    showArchiveSearchTooBroad: archive.isSearchTooBroad,
    showNoSearchResults:
      isSearching && !isSearchTooBroad && !isError && !isArchiveError && !isLoadingDeployments && !archive.isFetching && !hasPageResults && !hasAnyArchived,
    pageIndex,
    pageSize,
    changePageSize,
    goToPreviousPage,
    goToNextPage,
    hasNextPage,
    isPaginated,
    archivePageIndex,
    hasNextArchivePage,
    isArchivePaginated,
    goToPreviousArchivePage,
    goToNextArchivePage,
    /** Survives the page size growing past the last page, so the selector that did it stays on screen to undo it. */
    showPageSizeSelector: (hasPageResults || hasAnyArchived) && (isPaginated || isArchivePaginated || pageSize !== DEFAULT_PAGE_SIZE),
    isInitialLoad,
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
