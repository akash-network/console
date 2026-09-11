"use client";
import type { FC } from "react";
import { Checkbox, TableCell, TableRow } from "@akashnetwork/ui/components";
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
 * is hovered. Where hover does not exist (touch) they stay visible, keyboard focus reveals them everywhere, and
 * a ticked checkbox stays visible so a selection is never hidden by moving the pointer away.
 */
const HOVER_REVEALED =
  "transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100 data-[state=checked]:opacity-100";

export interface DeploymentRowProps {
  deployment: NamedDeploymentDto;
  providers: ApiProviderList[] | undefined;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (input: { id: string; isShiftPressed: boolean }) => void;
  onDeploymentClosed?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentRow: FC<DeploymentRowProps> = ({
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
    <TableRow className="group">
      {isSelectable && (
        <TableCell className="w-10">
          <Checkbox
            aria-label={`Select deployment ${deployment.name || deployment.dseq}`}
            checked={isSelected}
            expandedTouchTarget
            className={HOVER_REVEALED}
            onClick={event => onSelect?.({ id: deployment.dseq, isShiftPressed: event.shiftKey })}
          />
        </TableCell>
      )}
      <TableCell className="w-44 align-top">
        <div className="flex flex-col items-start gap-1">
          <d.DeploymentStatusBadge state={deployment.state} leases={leases} />
          <d.ReclamationCountdown leases={leases} />
        </div>
      </TableCell>
      <TableCell className="max-w-0 align-top">
        <Link href={UrlService.deploymentDetails(deployment.dseq)} className="block truncate font-semibold hover:underline">
          {deployment.name || `Deployment #${deployment.dseq}`}
        </Link>
      </TableCell>
      <TableCell className="max-w-0 align-top">
        <d.DeploymentEndpoints endpoints={endpoints} isLoading={isLoadingEndpoints} unreachableReason={unreachableReason} />
      </TableCell>
      <TableCell className="align-top">
        <d.DeploymentSpecSummary deployment={deployment} />
      </TableCell>
      <TableCell className="w-12 align-top">
        <div className={cn("flex justify-end", HOVER_REVEALED)}>
          <d.DeploymentActionsMenu deployment={deployment} onDeploymentClosed={onDeploymentClosed} />
        </div>
      </TableCell>
    </TableRow>
  );
};
