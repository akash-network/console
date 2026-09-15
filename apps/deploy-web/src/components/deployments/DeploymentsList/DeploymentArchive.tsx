"use client";
import type { FC } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  LoadingButton,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from "@akashnetwork/ui/components";
import { NavArrowRight, Refresh } from "iconoir-react";

import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import type { ListedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DeploymentsCollection } from "./DeploymentsCollection";

export const DEPENDENCIES = { DeploymentsCollection };

/** The archive is unbounded, so it lists a page at a time rather than mounting a lease query per closed deployment. */
export interface DeploymentArchiveProps {
  deployments: ListedDeploymentDto[];
  totalCount: number;
  providers: ApiProviderList[] | undefined;
  viewMode: DeploymentsViewMode;
  isError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  pageIndex: number;
  hasNextPage: boolean;
  isPaginated: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentArchive: FC<DeploymentArchiveProps> = ({
  deployments,
  totalCount,
  providers,
  viewMode,
  isError,
  isRetrying,
  onRetry,
  pageIndex,
  hasNextPage,
  isPaginated,
  onPreviousPage,
  onNextPage,
  dependencies: d = DEPENDENCIES
}) => {
  if (isError) {
    return (
      <div className="flex flex-wrap items-center gap-3 py-8">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load closed deployments.</p>
        <LoadingButton variant="outline" size="sm" loading={isRetrying} onClick={onRetry}>
          <Refresh className="mr-2 h-4 w-4" />
          Retry
        </LoadingButton>
      </div>
    );
  }

  if (totalCount === 0) return null;

  return (
    <Collapsible className="py-8">
      <CollapsibleTrigger className="group inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
        <NavArrowRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
        Archive // {totalCount} closed
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <d.DeploymentsCollection deployments={deployments} providers={providers} viewMode={viewMode} />
        {isPaginated && (
          <div className="flex justify-end px-2 pt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={onPreviousPage} disabled={pageIndex === 0} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext onClick={onNextPage} disabled={!hasNextPage} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
