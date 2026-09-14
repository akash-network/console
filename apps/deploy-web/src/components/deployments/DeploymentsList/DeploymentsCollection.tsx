"use client";
import type { FC } from "react";
import { Card, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";

import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import type { NamedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DeploymentCard } from "./DeploymentCard";
import { DeploymentRow } from "./DeploymentRow";

export const DEPENDENCIES = { DeploymentCard, DeploymentRow };

const LOADING_PLACEHOLDERS = ["first", "second", "third"];

export interface DeploymentsCollectionProps {
  deployments: NamedDeploymentDto[];
  providers: ApiProviderList[] | undefined;
  viewMode: DeploymentsViewMode;
  isLoading?: boolean;
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
  isLoading,
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
        {isLoading
          ? LOADING_PLACEHOLDERS.map(key => <CardPlaceholder key={key} />)
          : deployments.map(deployment => <d.DeploymentCard key={deployment.dseq} {...itemProps(deployment)} />)}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[14%]">Status</TableHead>
            <TableHead className="w-[24%]">Deployment</TableHead>
            <TableHead className="w-[32%]">Endpoint</TableHead>
            <TableHead className="w-[24%]">Hardware</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? LOADING_PLACEHOLDERS.map(key => <RowPlaceholder key={key} />)
            : deployments.map(deployment => <d.DeploymentRow key={deployment.dseq} {...itemProps(deployment)} />)}
        </TableBody>
      </Table>
    </div>
  );
};

const CardPlaceholder: FC = () => (
  <Card className="flex flex-col overflow-hidden" data-testid="deployment-placeholder">
    <div className="flex flex-1 flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-5 py-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
  </Card>
);

const RowPlaceholder: FC = () => (
  <TableRow data-testid="deployment-placeholder">
    <TableCell>
      <Skeleton className="h-6 w-20 rounded-full" />
    </TableCell>
    <TableCell className="max-w-0">
      <Skeleton className="h-4 w-32" />
    </TableCell>
    <TableCell className="max-w-0">
      <Skeleton className="h-4 w-40" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-36" />
    </TableCell>
    <TableCell className="w-px pl-0">
      <Skeleton className="ml-auto h-10 w-10 rounded-full" />
    </TableCell>
  </TableRow>
);
