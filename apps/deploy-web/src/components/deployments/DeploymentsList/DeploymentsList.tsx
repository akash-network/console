"use client";
import type { ChangeEvent, MouseEvent, ReactNode } from "react";
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
import { ChevronRight, LayoutGrid, List, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { ProjectScopeProvider } from "@src/components/projects/ProjectScope/ProjectScope";
import { LinkTo } from "@src/components/shared/LinkTo";
import { useBlockchainStatus } from "@src/context/BlockchainStatusProvider";
import { useNewDeploymentUrl } from "@src/hooks/useNewDeploymentUrl/useNewDeploymentUrl";
import { useProjectsUi } from "@src/hooks/useProjectsUi/useProjectsUi";
import Layout from "../../layout/Layout";
import { DeploymentArchive } from "./DeploymentArchive";
import { DeploymentsCollection } from "./DeploymentsCollection";
import { DeploymentsEmptyState } from "./DeploymentsEmptyState";
import { useDeploymentsListModel } from "./useDeploymentsListModel";

/** The api rejects a search longer than a deployment name may be, so the box stops one from being entered. */
export const MAX_SEARCH_LENGTH = 256;

export const DEPENDENCIES = {
  useDeploymentsListModel,
  useBlockchainStatus,
  useNewDeploymentUrl,
  Layout,
  DeploymentsEmptyState,
  DeploymentsCollection,
  DeploymentArchive,
  useProjectsUi,
  NextSeo
};

/** Narrows the list to one project, with the project page's own title and side column. */
export interface DeploymentsListProject {
  id: string;
  name: string;
  title: ReactNode;
  aside: ReactNode;
}

interface Props {
  project?: DeploymentsListProject;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentsList: React.FunctionComponent<Props> = ({ project, dependencies: d = DEPENDENCIES }) => {
  const model = d.useDeploymentsListModel({ projectId: project?.id });
  const { isBlockchainDown } = d.useBlockchainStatus();
  const newDeploymentUrl = d.useNewDeploymentUrl();
  const { canChangeDeployments } = d.useProjectsUi();

  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => model.changeSearch(event.target.value);

  const startNewDeploymentUnlessChainIsDown = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isBlockchainDown) {
      event.preventDefault();
      return;
    }

    model.startNewDeployment();
  };

  const content = (
    <>
      {model.showErrorState && (
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <p className="text-muted-foreground">Couldn&apos;t load deployments.</p>
          <Button variant="outline" size="sm" onClick={model.refetchDeployments}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {model.hasSettledWithoutActiveDeployments && (
        <d.DeploymentsEmptyState
          onDeployClick={model.startNewDeployment}
          canDeploy={canChangeDeployments}
          projectId={project?.id}
          hasDeployments={model.hasAnyArchived}
          showTemplatesButton={!model.hasAnyArchived}
        />
      )}

      {(model.hasPageResults || model.isInitialLoad) && (
        <d.DeploymentsCollection
          deployments={model.pageDeployments}
          providers={model.providers}
          viewMode={model.viewMode}
          isLoading={model.isInitialLoad}
          isSelectable={canChangeDeployments}
          selectedIds={model.selectedItemIds}
          closingDseqs={model.closingDseqs}
          onSelect={model.selectItem}
          onDeploymentClosed={model.refetchDeployments}
        />
      )}

      {model.showNoSearchResults && <p className="py-6">No deployment found.</p>}

      {model.showSearchTooBroad && <p className="py-6">Too many deployments to search through. Clear the search to page through them instead.</p>}

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
        deployments={model.archivePageDeployments}
        totalCount={model.archiveTotal}
        providers={model.providers}
        viewMode={model.viewMode}
        isError={model.showArchiveError}
        isSearchTooBroad={model.showArchiveSearchTooBroad}
        isRetrying={model.isRetryingArchive}
        onRetry={model.refetchDeployments}
        pageIndex={model.archivePageIndex}
        hasNextPage={model.hasNextArchivePage}
        isPaginated={model.isArchivePaginated}
        onPreviousPage={model.goToPreviousArchivePage}
        onNextPage={model.goToNextArchivePage}
      />
    </>
  );

  return (
    <d.Layout background="dots" isLoading={model.isLoadingDeployments || model.isLoadingProviders} disableContainer>
      <d.NextSeo title={project?.name ?? "Deployments"} />

      <div className="flex flex-col md:h-page-viewport">
        {model.hasWallet && (
          <div className="flex min-h-[60px] shrink-0 items-center border-b border-border bg-background py-2">
            <div className="container flex flex-wrap items-center gap-3 px-4 sm:px-6">
              <div className="mr-auto flex items-center gap-6">
                {project?.title ?? <h1 className="whitespace-nowrap text-xl font-bold leading-7 tracking-[-0.02em]">Deployments</h1>}

                {model.selectedItemIds.length > 0 && (
                  <>
                    <Button onClick={model.closeSelectedDeployments} variant="outline" size="sm">
                      Close selected ({model.selectedItemIds.length})
                    </Button>
                    <LinkTo className="text-sm" onClick={model.clearSelection}>
                      Clear
                    </LinkTo>
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
                    maxLength={MAX_SEARCH_LENGTH}
                    className="w-full sm:w-64"
                    type="text"
                    startIcon={<Search className="ml-3 h-4 w-4 text-muted-foreground" />}
                    endIcon={
                      !!model.search && (
                        <Button size="icon" variant="text" aria-label="Clear search" onClick={() => model.changeSearch("")}>
                          <X className="h-4 w-4" />
                        </Button>
                      )
                    }
                  />

                  <ToggleGroup type="single" value={model.viewMode} onValueChange={model.changeViewMode} variant="outline" className="gap-0 rounded-md border">
                    <ToggleGroupItem value="grid" aria-label="Grid view" className="rounded-r-none border-0">
                      <LayoutGrid className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="list" aria-label="List view" className="rounded-l-none border-0">
                      <List className="h-4 w-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </>
              )}

              {model.showNewDeploymentLink && canChangeDeployments && (
                <Link
                  href={newDeploymentUrl({ projectId: project?.id })}
                  className={cn("space-x-2", buttonVariants({ variant: "default" }), isBlockchainDown && "pointer-events-none opacity-50")}
                  aria-disabled={isBlockchainDown}
                  onClick={startNewDeploymentUnlessChainIsDown}
                >
                  <span className="whitespace-nowrap">New deployment</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
          <div className="container p-6 pb-8">
            {project ? (
              <ProjectScopeProvider value={project.id}>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0">{content}</div>
                  <aside className="min-w-0 space-y-6">{project.aside}</aside>
                </div>
              </ProjectScopeProvider>
            ) : (
              content
            )}
          </div>
        </div>
      </div>
    </d.Layout>
  );
};
