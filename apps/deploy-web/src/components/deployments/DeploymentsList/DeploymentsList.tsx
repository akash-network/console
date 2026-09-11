"use client";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  buttonVariants,
  Input,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationSizeSelector,
  Spinner,
  ToggleGroup,
  ToggleGroupItem
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { List, NavArrowRight, Refresh, Search, ViewGrid, Xmark } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { LinkTo } from "@src/components/shared/LinkTo";
import { useBlockchainStatus } from "@src/context/BlockchainStatusProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useListSelection } from "@src/hooks/useListSelection/useListSelection";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useNewDeploymentUrl } from "@src/hooks/useNewDeploymentUrl/useNewDeploymentUrl";
import { useDeploymentList, useDeploymentsPage } from "@src/queries/useDeploymentQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { deploymentsViewModeAtom } from "@src/store/deploymentsViewStore";
import sdlStore from "@src/store/sdlStore";
import type { DeploymentDto, NamedDeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { NoDeploymentsState } from "../../home/NoDeploymentsState";
import Layout from "../../layout/Layout";
import { DeploymentArchive } from "./DeploymentArchive";
import { DeploymentsCollection } from "./DeploymentsCollection";

export const DEPENDENCIES = {
  useWallet,
  useProviderList,
  useBlockchainStatus,
  useLocalNotes,
  useManagedDeploymentConfirm,
  useNewDeploymentUrl,
  useDeploymentsPage,
  useDeploymentList,
  Layout,
  NoDeploymentsState,
  DeploymentsCollection,
  DeploymentArchive
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentsList: React.FunctionComponent<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const { address, signAndBroadcastTx, hasWallet } = d.useWallet();
  const { data: providers, isFetching: isLoadingProviders } = d.useProviderList();
  const { isBlockchainDown } = d.useBlockchainStatus();
  const { getDeploymentName } = d.useLocalNotes();
  const { closeDeploymentConfirm } = d.useManagedDeploymentConfirm();
  const newDeploymentUrl = d.useNewDeploymentUrl();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const [viewMode, setViewMode] = useAtom(deploymentsViewModeAtom);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(12);
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

  const pageDeployments = useMemo(() => {
    if (!isSearching) return activeDeployments;
    return activeDeployments.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [activeDeployments, isSearching, pageIndex, pageSize]);

  const isLoadingDeployments = isSearching ? activeList.isFetching : activePage.isFetching;
  const isError = isSearching ? activeList.isError : activePage.isError;
  const refetchDeployments = () => {
    if (isSearching) activeList.refetch();
    else activePage.refetch();
    archiveList.refetch();
  };

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

  const { selectedItemIds, selectItem, clearSelection } = useListSelection<string>({ ids: pageDeployments.map(deployment => deployment.dseq) });

  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPageIndex(0);
  };

  const clearSearch = () => {
    setSearch("");
    setPageIndex(0);
  };

  const changePageSize = (value: number) => {
    setPageSize(value);
    setPageIndex(0);
  };

  const changeViewMode = (value: string) => {
    if (value === "grid" || value === "list") setViewMode(value);
  };

  const closeSelectedDeployments = async () => {
    if (!(await closeDeploymentConfirm(selectedItemIds))) return;

    const messages = selectedItemIds.map(dseq => TransactionMessageData.getCloseDeploymentMsg(address, `${dseq}`));
    const response = await signAndBroadcastTx(messages);
    if (!response) return;

    refetchDeployments();
    clearSelection();
  };

  const startNewDeployment = () => setDeploySdl(null);

  const hasAnyDeployment = hasPageResults || pageIndex > 0 || archiveDeployments.length > 0;
  const hasSettledWithoutActiveDeployments = !hasPageResults && pageIndex === 0 && !isLoadingDeployments && !isError && !isSearching && !archiveList.isFetching;
  const showErrorState = isError && !hasPageResults && !isLoadingDeployments;

  return (
    <d.Layout isLoading={isLoadingDeployments || isLoadingProviders}>
      <NextSeo title="Deployments" />

      {hasWallet && (
        <div className="flex flex-wrap items-center gap-3 pb-6">
          <h1 className="mr-auto text-3xl font-bold tracking-tight">Deployments</h1>

          {(hasAnyDeployment || isSearching) && (
            <>
              <Input
                value={search}
                onChange={changeSearch}
                aria-label="Search deployments"
                placeholder="Search deployments"
                className="w-full sm:w-64"
                type="text"
                startIcon={<Search className="text-xs text-muted-foreground" />}
                endIcon={
                  !!search && (
                    <Button size="icon" variant="text" aria-label="Clear search" onClick={clearSearch}>
                      <Xmark className="text-xs" />
                    </Button>
                  )
                }
              />

              <Button aria-label="Refresh deployments" onClick={refetchDeployments} size="icon" variant="ghost">
                <Refresh />
              </Button>

              <ToggleGroup type="single" value={viewMode} onValueChange={changeViewMode} variant="outline" className="gap-0 rounded-md border">
                <ToggleGroupItem value="grid" aria-label="Grid view" className="rounded-r-none border-0">
                  <ViewGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" className="rounded-l-none border-0">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </>
          )}

          {hasAnyDeployment && (
            <Link
              href={newDeploymentUrl()}
              className={cn("space-x-2", buttonVariants({ variant: "default" }))}
              aria-disabled={isBlockchainDown}
              onClick={startNewDeployment}
            >
              <span className="whitespace-nowrap">New deployment</span>
              <NavArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      {selectedItemIds.length > 0 && (
        <div className="flex items-center gap-4 pb-6">
          <Button onClick={closeSelectedDeployments} color="secondary" size="sm">
            Close selected ({selectedItemIds.length})
          </Button>
          <LinkTo onClick={clearSelection}>Clear</LinkTo>
        </div>
      )}

      {showErrorState && (
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <p className="text-muted-foreground">Couldn&apos;t load deployments.</p>
          <Button variant="outline" size="sm" onClick={refetchDeployments}>
            <Refresh className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {hasSettledWithoutActiveDeployments && (
        <d.NoDeploymentsState
          onDeployClick={startNewDeployment}
          hasDeployments={archiveDeployments.length > 0}
          showTemplatesButton={archiveDeployments.length === 0}
        />
      )}

      {!hasPageResults && isLoadingDeployments && (
        <div className="flex items-center justify-center p-8">
          <Spinner size="large" />
        </div>
      )}

      {hasPageResults && (
        <d.DeploymentsCollection
          deployments={pageDeployments}
          providers={providers}
          viewMode={viewMode}
          isSelectable
          selectedIds={selectedItemIds}
          onSelect={selectItem}
          onDeploymentClosed={refetchDeployments}
        />
      )}

      {isSearching && !isError && !isLoadingDeployments && pageDeployments.length === 0 && archiveDeployments.length === 0 && (
        <p className="py-6">No deployment found.</p>
      )}

      {hasPageResults && (
        <div className="flex flex-col items-center justify-between px-2 py-8 md:flex-row md:space-x-4">
          <PaginationSizeSelector pageSize={pageSize} setPageSize={changePageSize} />
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setPageIndex(current => current - 1)} disabled={pageIndex === 0} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={() => setPageIndex(current => current + 1)} disabled={!hasNextPage} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <d.DeploymentArchive deployments={archiveDeployments} providers={providers} viewMode={viewMode} />
    </d.Layout>
  );
};

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
