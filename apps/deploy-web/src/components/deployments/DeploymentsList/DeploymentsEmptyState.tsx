"use client";
import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Plus } from "iconoir-react";
import Link from "next/link";

import { useServices } from "@src/context/ServicesProvider";
import { useNewDeploymentUrl } from "@src/hooks/useNewDeploymentUrl/useNewDeploymentUrl";

export const DEPENDENCIES = { useNewDeploymentUrl };

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

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {hasDeployments ? "0 active deployments" : "0 deployments on the supercloud"}
      </p>

      <h3 className="mt-3 text-2xl font-bold tracking-tight">{hasDeployments ? "Deploy your next workload" : "Deploy your first workload"}</h3>

      <Button className="mt-6" onClick={onDeployClick} asChild>
        <Link href={newDeploymentUrl()}>
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
