"use client";
import type { FC } from "react";
import { Card, Checkbox } from "@akashnetwork/ui/components";
import Link from "next/link";

import type { NamedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { UrlService } from "@src/utils/urlUtils";
import { DeploymentStatusBadge } from "../DeploymentDetail/DeploymentStatusBadge";
import { DeploymentActionsMenu } from "./DeploymentActionsMenu";
import { DeploymentEndpoints } from "./DeploymentEndpoints";
import { DeploymentSpecSummary } from "./DeploymentSpecSummary";
import { ReclamationCountdown } from "./ReclamationCountdown";
import { useDeploymentReachability } from "./useDeploymentReachability";

export const DEPENDENCIES = {
  useDeploymentReachability,
  DeploymentStatusBadge,
  DeploymentEndpoints,
  DeploymentSpecSummary,
  DeploymentActionsMenu,
  ReclamationCountdown
};

export interface DeploymentCardProps {
  deployment: NamedDeploymentDto;
  providers: ApiProviderList[] | undefined;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (input: { id: string; isShiftPressed: boolean }) => void;
  onDeploymentClosed?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentCard: FC<DeploymentCardProps> = ({
  deployment,
  providers,
  isSelectable,
  isSelected,
  onSelect,
  onDeploymentClosed,
  dependencies: d = DEPENDENCIES
}) => {
  const { leases, endpoints, isLoadingEndpoints, unreachableReason } = d.useDeploymentReachability({ deployment, providers });

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={UrlService.deploymentDetails(deployment.dseq)} className="truncate font-bold hover:underline">
            {deployment.name || `Deployment #${deployment.dseq}`}
          </Link>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <d.DeploymentStatusBadge state={deployment.state} leases={leases} />
            <d.ReclamationCountdown leases={leases} />
          </div>
        </div>

        <d.DeploymentEndpoints endpoints={endpoints} isLoading={isLoadingEndpoints} unreachableReason={unreachableReason} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-5 py-2">
        <d.DeploymentSpecSummary deployment={deployment} className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-1">
          {isSelectable && (
            <Checkbox
              aria-label={`Select deployment ${deployment.name || deployment.dseq}`}
              checked={isSelected}
              expandedTouchTarget
              className="shrink-0"
              onClick={event => onSelect?.({ id: deployment.dseq, isShiftPressed: event.shiftKey })}
            />
          )}
          <d.DeploymentActionsMenu deployment={deployment} onDeploymentClosed={onDeploymentClosed} />
        </div>
      </div>
    </Card>
  );
};
