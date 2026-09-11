"use client";
import type { FC } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";

import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import type { NamedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DeploymentCard } from "./DeploymentCard";
import { DeploymentRow } from "./DeploymentRow";

export const DEPENDENCIES = { DeploymentCard, DeploymentRow };

export interface DeploymentsCollectionProps {
  deployments: NamedDeploymentDto[];
  providers: ApiProviderList[] | undefined;
  viewMode: DeploymentsViewMode;
  isSelectable?: boolean;
  selectedIds?: string[];
  onSelect?: (input: { id: string; isShiftPressed: boolean }) => void;
  onDeploymentClosed?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentsCollection: FC<DeploymentsCollectionProps> = ({
  deployments,
  providers,
  viewMode,
  isSelectable,
  selectedIds,
  onSelect,
  onDeploymentClosed,
  dependencies: d = DEPENDENCIES
}) => {
  const itemProps = (deployment: NamedDeploymentDto) => ({
    deployment,
    providers,
    isSelectable,
    isSelected: selectedIds?.includes(deployment.dseq) ?? false,
    onSelect,
    onDeploymentClosed
  });

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {deployments.map(deployment => (
          <d.DeploymentCard key={deployment.dseq} {...itemProps(deployment)} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {isSelectable && <TableHead className="w-10" />}
            <TableHead>Status</TableHead>
            <TableHead>Deployment</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead>Hardware</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {deployments.map(deployment => (
            <d.DeploymentRow key={deployment.dseq} {...itemProps(deployment)} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
