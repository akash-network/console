"use client";
import type { ChangeEvent, MouseEvent } from "react";
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
import Link from "next/link";
import { NextSeo } from "next-seo";

import { LinkTo } from "@src/components/shared/LinkTo";
import { useBlockchainStatus } from "@src/context/BlockchainStatusProvider";
import { useNewDeploymentUrl } from "@src/hooks/useNewDeploymentUrl/useNewDeploymentUrl";
import { NoDeploymentsState } from "../../home/NoDeploymentsState";
import Layout from "../../layout/Layout";
import { DeploymentArchive } from "./DeploymentArchive";
import { DeploymentsCollection } from "./DeploymentsCollection";
import { useDeploymentsListModel } from "./useDeploymentsListModel";

export const DEPENDENCIES = {
  useDeploymentsListModel,
  useBlockchainStatus,
  useNewDeploymentUrl,
  Layout,
  NoDeploymentsState,
  DeploymentsCollection,
  DeploymentArchive
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentsList: React.FunctionComponent<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const model = d.useDeploymentsListModel();
  const { isBlockchainDown } = d.useBlockchainStatus();
  const newDeploymentUrl = d.useNewDeploymentUrl();

  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => model.changeSearch(event.target.value);

  const startNewDeploymentUnlessChainIsDown = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isBlockchainDown) {
      event.preventDefault();
      return;
    }

    model.startNewDeployment();
  };

  return (
    <d.Layout isLoading={model.isLoadingDeployments || model.isLoadingProviders}>
      <NextSeo title="Deployments" />

      {model.hasWallet && (
        <div className="flex flex-wrap items-center gap-3 pb-6">
          <h1 className="mr-auto text-3xl font-bold tracking-tight">Deployments</h1>

          {(model.hasAnyDeployment || model.isSearching) && (
            <>
              <Input
                value={model.search}
                onChange={changeSearch}
                aria-label="Search deployments"
                placeholder="Search deployments"
                className="w-full sm:w-64"
                type="text"
                startIcon={<Search className="text-xs text-muted-foreground" />}
                endIcon={
                  !!model.search && (
                    <Button size="icon" variant="text" aria-label="Clear search" onClick={() => model.changeSearch("")}>
                      <Xmark className="text-xs" />
                    </Button>
                  )
                }
              />

              <Button aria-label="Refresh deployments" onClick={model.refetchDeployments} size="icon" variant="ghost">
                <Refresh />
              </Button>

              <ToggleGroup type="single" value={model.viewMode} onValueChange={model.changeViewMode} variant="outline" className="gap-0 rounded-md border">
                <ToggleGroupItem value="grid" aria-label="Grid view" className="rounded-r-none border-0">
                  <ViewGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" className="rounded-l-none border-0">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </>
          )}

          {model.hasAnyDeployment && (
            <Link
              href={newDeploymentUrl()}
              className={cn("space-x-2", buttonVariants({ variant: "default" }), isBlockchainDown && "pointer-events-none opacity-50")}
              aria-disabled={isBlockchainDown}
              onClick={startNewDeploymentUnlessChainIsDown}
            >
              <span className="whitespace-nowrap">New deployment</span>
              <NavArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      {model.selectedItemIds.length > 0 && (
        <div className="flex items-center gap-4 pb-6">
          <Button onClick={model.closeSelectedDeployments} color="secondary" size="sm">
            Close selected ({model.selectedItemIds.length})
          </Button>
          <LinkTo onClick={model.clearSelection}>Clear</LinkTo>
        </div>
      )}

      {model.showErrorState && (
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <p className="text-muted-foreground">Couldn&apos;t load deployments.</p>
          <Button variant="outline" size="sm" onClick={model.refetchDeployments}>
            <Refresh className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {model.hasSettledWithoutActiveDeployments && (
        <d.NoDeploymentsState
          onDeployClick={model.startNewDeployment}
          hasDeployments={model.archiveDeployments.length > 0}
          showTemplatesButton={model.archiveDeployments.length === 0}
        />
      )}

      {!model.hasPageResults && model.isLoadingDeployments && (
        <div className="flex items-center justify-center p-8">
          <Spinner size="large" />
        </div>
      )}

      {model.hasPageResults && (
        <d.DeploymentsCollection
          deployments={model.pageDeployments}
          providers={model.providers}
          viewMode={model.viewMode}
          isSelectable
          selectedIds={model.selectedItemIds}
          onSelect={model.selectItem}
          onDeploymentClosed={model.refetchDeployments}
        />
      )}

      {model.showNoSearchResults && <p className="py-6">No deployment found.</p>}

      {model.hasPageResults && (
        <div className="flex flex-col items-center justify-between px-2 py-8 md:flex-row md:space-x-4">
          <PaginationSizeSelector pageSize={model.pageSize} setPageSize={model.changePageSize} />
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={model.goToPreviousPage} disabled={model.pageIndex === 0} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={model.goToNextPage} disabled={!model.hasNextPage} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <d.DeploymentArchive deployments={model.archiveDeployments} providers={model.providers} viewMode={model.viewMode} />
    </d.Layout>
  );
};
