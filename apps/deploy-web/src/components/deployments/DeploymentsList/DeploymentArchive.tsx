"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { NavArrowRight } from "iconoir-react";

import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import type { NamedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DeploymentsCollection } from "./DeploymentsCollection";

export const DEPENDENCIES = { DeploymentsCollection };

/** The archive is unbounded, so it reveals a page at a time rather than mounting a lease query per closed deployment. */
const ARCHIVE_PAGE_SIZE = 12;

export interface DeploymentArchiveProps {
  deployments: NamedDeploymentDto[];
  providers: ApiProviderList[] | undefined;
  viewMode: DeploymentsViewMode;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentArchive: FC<DeploymentArchiveProps> = ({ deployments, providers, viewMode, dependencies: d = DEPENDENCIES }) => {
  const [visibleCount, setVisibleCount] = useState(ARCHIVE_PAGE_SIZE);

  if (deployments.length === 0) return null;

  return (
    <Collapsible className="py-8">
      <CollapsibleTrigger className="group inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
        <NavArrowRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
        Archive // {deployments.length} closed
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <d.DeploymentsCollection deployments={deployments.slice(0, visibleCount)} providers={providers} viewMode={viewMode} />
        {deployments.length > visibleCount && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" size="sm" onClick={() => setVisibleCount(current => current + ARCHIVE_PAGE_SIZE)}>
              Show more
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
