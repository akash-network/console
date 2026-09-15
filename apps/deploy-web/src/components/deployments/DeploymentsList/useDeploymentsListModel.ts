"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MIN_PAGE_SIZE } from "@akashnetwork/ui/components";
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

/** Must stay one of the sizes PaginationSizeSelector offers, or the selector renders blank. */
export const DEFAULT_PAGE_SIZE = MIN_PAGE_SIZE;

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
  const [archivePageIndex, setArchivePageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");

  const isSearching = search.trim().length > 0;
  const canQuery = !!address;

  const activePage = d.useDeploymentsPage(address, { state: "active", skip: pageIndex * pageSize, limit: pageSize }, { enabled: canQuery && !isSearching });
  const activeList = d.useDeploymentList(address, { enabled: canQuery && isSearching }, "active");
  const archiveList = d.useDeploymentList(address, { enabled: canQuery }, "closed");

  const fetchedActiveDeployments = isSearching ? activeList.data : activePage.data?.deployments;

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
  /** Reads every fetched list rather than the filtered or currently selected one, so neither a search that matches nothing nor the switch into one reads as an empty account. */
  const hasAnyDeployment = !!activePage.data?.deployments.length || !!activeList.data?.length || pageIndex > 0 || !!archiveList.data?.length;
  const hasNextPage = isSearching ? (pageIndex + 1) * pageSize < activeDeployments.length : activePage.data?.hasNextPage ?? false;
  const isPaginated = hasNextPage || pageIndex > 0;
  const hasNextArchivePage = (archivePageIndex + 1) * pageSize < archiveDeployments.length;
  const isArchivePaginated = hasNextArchivePage || archivePageIndex > 0;
  /** Both queries feed the choice between rows and the empty state, so neither can be decided until both have data. */
  const hasResolvedActiveAndArchive = activePage.data !== undefined && archiveList.data !== undefined;
  const isInitialLoad = canQuery && !hasPageResults && !isError && !isArchiveError && !hasResolvedActiveAndArchive;
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
      if (archivePageIndex > 0 && !archiveList.isFetching && archivePageDeployments.length === 0) {
        setArchivePageIndex(current => Math.max(current - 1, 0));
      }
    },
    [archiveList.isFetching, archivePageIndex, archivePageDeployments.length]
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
    isRetryingArchive: isArchiveError && archiveList.isFetching,
    showNoSearchResults:
      isSearching && !isError && !isArchiveError && !isLoadingDeployments && !archiveList.isFetching && !hasPageResults && archiveDeployments.length === 0,
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
    showPageSizeSelector: hasPageResults && (isPaginated || pageSize !== DEFAULT_PAGE_SIZE),
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
