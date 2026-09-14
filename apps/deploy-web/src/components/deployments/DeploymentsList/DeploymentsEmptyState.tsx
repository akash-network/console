"use client";
import type { FC, MouseEvent } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";
import Link from "next/link";

import { useBlockchainStatus } from "@src/context/BlockchainStatusProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useNewDeploymentUrl } from "@src/hooks/useNewDeploymentUrl/useNewDeploymentUrl";

export const DEPENDENCIES = { useNewDeploymentUrl, useBlockchainStatus };

export interface DeploymentsEmptyStateProps {
  onDeployClick: () => void;
  hasDeployments?: boolean;
  showTemplatesButton?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentsEmptyState: FC<DeploymentsEmptyStateProps> = ({
  onDeployClick,
  hasDeployments = false,
  showTemplatesButton = true,
  dependencies: d = DEPENDENCIES
}) => {
  const { urlService } = useServices();
  const newDeploymentUrl = d.useNewDeploymentUrl();
  const { isBlockchainDown } = d.useBlockchainStatus();

  const startNewDeploymentUnlessChainIsDown = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isBlockchainDown) {
      event.preventDefault();
      return;
    }

    onDeployClick();
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {hasDeployments ? "0 active deployments" : "0 deployments on the supercloud"}
      </p>

      <h3 className="mt-3 text-2xl font-bold tracking-tight">{hasDeployments ? "Deploy your next workload" : "Deploy your first workload"}</h3>

      <Button className="mt-6" asChild>
        <Link
          href={newDeploymentUrl()}
          className={cn(isBlockchainDown && "pointer-events-none opacity-50")}
          aria-disabled={isBlockchainDown}
          onClick={startNewDeploymentUnlessChainIsDown}
        >
          <Plus className="mr-2 h-4 w-4" />
          New deployment
        </Link>
      </Button>

      {showTemplatesButton && (
        <Link href={urlService.templates()} className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline">
          Browse templates
        </Link>
      )}
    </div>
  );
};
