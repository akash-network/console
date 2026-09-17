"use client";
import type { FC } from "react";
import { Card, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";

import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import type { ListedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DeploymentCard } from "./DeploymentCard";
import { DeploymentRow } from "./DeploymentRow";

export const DEPENDENCIES = { DeploymentCard, DeploymentRow };

const LOADING_PLACEHOLDERS = ["first", "second", "third"];

/**
 * The archive renders a second table below this one, and only a fixed layout keeps the two reading as one grid:
 * an auto layout sizes each table to its own rows, which differ by the archive's missing checkbox and its much
 * shorter endpoint text. Under a fixed layout only the header row's widths count, so the columns are declared
 * there and the body cells carry none.
 */
const TABLE_LAYOUT = "min-w-[68rem] table-fixed";

/** Wide enough for the hardware summary's own fixed columns, and for the checkbox the archive's rows leave out. */
const HARDWARE_COLUMN = "w-[24.5rem]";
const CONTROLS_COLUMN = "w-[6.25rem]";

export interface DeploymentsCollectionProps {
  deployments: ListedDeploymentDto[];
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
  const itemProps = (deployment: ListedDeploymentDto) => ({
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
      <Table className={TABLE_LAYOUT}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-52">Status</TableHead>
            <TableHead>Deployment</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead className={HARDWARE_COLUMN}>Hardware</TableHead>
            <TableHead className={CONTROLS_COLUMN} />
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
    <TableCell>
      <Skeleton className="h-4 w-32" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-40" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-36" />
    </TableCell>
    <TableCell className="pl-0">
      <Skeleton className="ml-auto h-10 w-10 rounded-full" />
    </TableCell>
  </TableRow>
);
