"use client";
import type { FC } from "react";
import { useState } from "react";
import { Checkbox, TableCell, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";

import type { NamedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { UrlService } from "@src/utils/urlUtils";
import { DeploymentStatusBadge } from "../DeploymentDetail/DeploymentStatusBadge";
import { DeploymentActionsMenu } from "./DeploymentActionsMenu";
import { DeploymentEndpoints, DeploymentEndpointsPanel } from "./DeploymentEndpoints";
import { DeploymentSpecSummary } from "./DeploymentSpecSummary";
import { ReclamationCountdown } from "./ReclamationCountdown";
import { useDeploymentReachability } from "./useDeploymentReachability";

export const DEPENDENCIES = {
  useDeploymentReachability,
  DeploymentStatusBadge,
  DeploymentEndpoints,
  DeploymentEndpointsPanel,
  DeploymentSpecSummary,
  DeploymentActionsMenu,
  ReclamationCountdown
};

/** TableCell zeroes its right padding for any cell holding a checkbox, which would pin these controls to the table's edge. */
const CONTROLS_CELL = "w-px pl-0 [&:has([role=checkbox])]:pr-4";

const COLUMN_COUNT = 5;

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
  const [isShowingEndpoints, setIsShowingEndpoints] = useState(false);
  const toggleEndpoints = () => setIsShowingEndpoints(current => !current);

  return (
    <>
      <TableRow className={cn(isShowingEndpoints && "border-b-0")}>
        <TableCell>
          <div className="flex flex-col items-start gap-1">
            <d.DeploymentStatusBadge state={deployment.state} leases={leases} />
            <d.ReclamationCountdown leases={leases} />
          </div>
        </TableCell>
        <TableCell className="max-w-0">
          <Link href={UrlService.deploymentDetails(deployment.dseq)} className="block truncate font-semibold hover:underline">
            {deployment.name || `Deployment #${deployment.dseq}`}
          </Link>
        </TableCell>
        <TableCell className="max-w-0">
          <d.DeploymentEndpoints
            endpoints={endpoints}
            isLoading={isLoadingEndpoints}
            unreachableReason={unreachableReason}
            isExpanded={isShowingEndpoints}
            onToggleExpanded={toggleEndpoints}
          />
        </TableCell>
        <TableCell>
          <d.DeploymentSpecSummary deployment={deployment} />
        </TableCell>
        <TableCell className={CONTROLS_CELL}>
          <div className="flex items-center justify-end gap-1">
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
        </TableCell>
      </TableRow>

      {isShowingEndpoints && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={COLUMN_COUNT} className="px-4 pb-4 pt-0">
            <d.DeploymentEndpointsPanel endpoints={endpoints} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
