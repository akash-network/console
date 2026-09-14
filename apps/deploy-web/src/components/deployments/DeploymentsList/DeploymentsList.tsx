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
import Layout from "../../layout/Layout";
import { DeploymentArchive } from "./DeploymentArchive";
import { DeploymentsCollection } from "./DeploymentsCollection";
import { DeploymentsEmptyState } from "./DeploymentsEmptyState";
import { useDeploymentsListModel } from "./useDeploymentsListModel";

export const DEPENDENCIES = {
  useDeploymentsListModel,
  useBlockchainStatus,
  useNewDeploymentUrl,
  Layout,
  DeploymentsEmptyState,
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
          <div className="mr-auto flex items-center gap-6">
            <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>

            {model.selectedItemIds.length > 0 && (
              <>
                <Button onClick={model.closeSelectedDeployments} color="secondary" size="sm">
                  Close selected ({model.selectedItemIds.length})
                </Button>
                <LinkTo onClick={model.clearSelection}>Clear</LinkTo>
              </>
            )}
          </div>

          {model.hasAnyDeployment && (
            <>
              <Input
                value={model.search}
                onChange={changeSearch}
                aria-label="Search deployments"
                placeholder="Search deployments"
                className="w-full sm:w-64"
                type="text"
                startIcon={<Search className="ml-3 h-4 w-4 text-muted-foreground" />}
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

          {model.showNewDeploymentLink && (
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
        <d.DeploymentsEmptyState
          onDeployClick={model.startNewDeployment}
          hasDeployments={model.archiveDeployments.length > 0}
          showTemplatesButton={model.archiveDeployments.length === 0}
        />
      )}

      {(model.hasPageResults || model.isInitialLoad) && (
        <d.DeploymentsCollection
          deployments={model.pageDeployments}
          providers={model.providers}
          viewMode={model.viewMode}
          isLoading={model.isInitialLoad}
          isSelectable
          selectedIds={model.selectedItemIds}
          onSelect={model.selectItem}
          onDeploymentClosed={model.refetchDeployments}
        />
      )}

      {model.showNoSearchResults && <p className="py-6">No deployment found.</p>}

      {model.showPageSizeSelector && (
        <div className="flex flex-col items-center justify-between px-2 py-8 md:flex-row md:space-x-4">
          <PaginationSizeSelector pageSize={model.pageSize} setPageSize={model.changePageSize} />
          {model.isPaginated && (
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
          )}
        </div>
      )}

      <d.DeploymentArchive
        deployments={model.archiveDeployments}
        providers={model.providers}
        viewMode={model.viewMode}
        isError={model.showArchiveError}
        isRetrying={model.isRetryingArchive}
        onRetry={model.refetchDeployments}
      />
    </d.Layout>
  );
};
