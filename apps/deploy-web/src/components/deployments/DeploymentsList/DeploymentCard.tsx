"use client";
import type { FC } from "react";
import { Card, Checkbox } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
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

/**
 * Selection and the actions menu are secondary to reading the card, so they stay out of the way until the card
 * is hovered. Where hover does not exist (touch) they stay visible, and keyboard focus reveals them everywhere.
 */
const HOVER_REVEALED = "transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100";

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
    <Card className="group flex flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {isSelectable && (
              <Checkbox
                aria-label={`Select deployment ${deployment.name || deployment.dseq}`}
                checked={isSelected}
                expandedTouchTarget
                className={cn("shrink-0", !isSelected && HOVER_REVEALED)}
                onClick={event => onSelect?.({ id: deployment.dseq, isShiftPressed: event.shiftKey })}
              />
            )}
            <Link href={UrlService.deploymentDetails(deployment.dseq)} className="truncate font-semibold hover:underline">
              {deployment.name || `Deployment #${deployment.dseq}`}
            </Link>
          </div>

          <div className="flex shrink-0 items-start gap-1">
            <div className="flex flex-col items-end gap-1">
              <d.DeploymentStatusBadge state={deployment.state} leases={leases} />
              <d.ReclamationCountdown leases={leases} />
            </div>
            <div className={HOVER_REVEALED}>
              <d.DeploymentActionsMenu deployment={deployment} onDeploymentClosed={onDeploymentClosed} />
            </div>
          </div>
        </div>

        <d.DeploymentEndpoints endpoints={endpoints} isLoading={isLoadingEndpoints} unreachableReason={unreachableReason} />
      </div>

      <d.DeploymentSpecSummary deployment={deployment} className="border-t px-5 py-3" />
    </Card>
  );
};
