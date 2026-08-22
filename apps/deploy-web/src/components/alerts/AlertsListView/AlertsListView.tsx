import type { FC } from "react";
import React from "react";
import { useCallback, useMemo } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import {
  Button,
  buttonVariants,
  Checkbox,
  CustomPagination,
  CustomTooltip,
  MIN_PAGE_SIZE,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import type { CellContext } from "@tanstack/react-table";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Bin, Edit } from "iconoir-react";
import { startCase } from "lodash";
import Link from "next/link";

import { AlertStatus } from "@src/components/alerts/AlertStatus/AlertStatus";
import { useFlag } from "@src/hooks/useFlag";
import { UrlService } from "@src/utils/urlUtils";

type Alert = components["schemas"]["AlertListOutputResponse"]["data"][0] & { deploymentName: string };
type AlertsPagination = components["schemas"]["AlertListOutputResponse"]["pagination"];

const DEPENDENCIES = {
  useFlag
};

export interface Props {
  data: Alert[];
  pagination: Pick<AlertsPagination, "page" | "limit" | "total" | "totalPages">;
  onPaginationChange: (params: { page: number; limit: number }) => void;
  onToggle: (id: string, enabled: boolean, dseq?: string) => void;
  onRemove: (id: string) => Promise<void>;
  loadingIds: Set<string>;
  removingIds: Set<string>;
  isLoading?: boolean;
  isError?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const AlertsListView: FC<Props> = ({
  data,
  pagination,
  onPaginationChange,
  isLoading,
  onToggle,
  onRemove,
  loadingIds,
  removingIds,
  isError,
  dependencies: d = DEPENDENCIES
}) => {
  const { confirm } = usePopup();
  const columnHelper = createColumnHelper<Alert>();
  const isAlertUpdateEnabled = d.useFlag("notifications_general_alerts_update");
  const isDeploymentDetailRedesignEnabled = d.useFlag("deployment_detail_redesign");
  const deploymentAlertsTab = isDeploymentDetailRedesignEnabled ? "SETTINGS" : "ALERTS";

  const visibleData = useMemo(() => data.filter(alert => alert.type !== "DEPLOYMENT_BALANCE"), [data]);

  const extractDseq = useCallback((info: CellContext<Alert, unknown>) => {
    const { params } = info.row.original;
    const dseq = params && "dseq" in params && params.dseq;

    return dseq || undefined;
  }, []);

  const columns = [
    columnHelper.accessor("enabled", {
      header: "Enabled",
      cell: info => {
        const id = info.row.original.id;
        const isBusy = loadingIds.has(id) || removingIds.has(id);
        return (
          <div className="flex items-center">
            <Checkbox
              checked={info.getValue()}
              disabled={isBusy}
              onCheckedChange={checked => {
                onToggle(id, !!checked, extractDseq(info));
              }}
              aria-label={"Toggle alert"}
            />
          </div>
        );
      }
    }),
    columnHelper.accessor("deploymentName", {
      header: "Deployment Name",
      cell: info => {
        const dseq = extractDseq(info);
        return dseq ? (
          <Link href={UrlService.deploymentDetails(dseq, deploymentAlertsTab)} className="font-bold">
            {info.getValue()}
          </Link>
        ) : (
          info.getValue()
        );
      }
    }),
    columnHelper.accessor("params", {
      header: "DSEQ",
      cell: info => extractDseq(info) ?? "N/A"
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: info => {
        const type = info.getValue();
        const params = info.row.original.params;

        if (params && "type" in params && params.type === "DEPLOYMENT_CLOSED") {
          return "Deployment Close";
        }

        return startCase(type.toLowerCase());
      }
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: info => <AlertStatus status={info.getValue()} />
    }),
    columnHelper.accessor("notificationChannelName", {
      header: "Notification Channel",
      cell: info => info.getValue()
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: info => {
        const alert = info.row.original;
        const isRemoving = removingIds.has(alert.id);

        return (
          <div className="flex items-center justify-end gap-1">
            {alert.type === "WALLET_BALANCE" && (
              <CustomTooltip title="Edit" disabled={isRemoving}>
                <Link
                  href={UrlService.alertDetails(alert.id)}
                  type="button"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-gray-500 hover:text-gray-700", isRemoving && "pointer-events-none")}
                  aria-disabled={isRemoving}
                  aria-label="Edit alert"
                  data-testid="edit-alert-button"
                >
                  <Edit className="text-xs" />
                </Link>
              </CustomTooltip>
            )}
            <CustomTooltip title="Remove" disabled={isRemoving}>
              <Button
                variant="ghost"
                size="icon"
                disabled={isRemoving}
                aria-label="Remove alert"
                onClick={async () => {
                  const isConfirmed = await confirm({
                    title: "Are you sure you want to remove this alert?",
                    message: "This action cannot be undone.",
                    testId: "remove-alert-confirmation-popup"
                  });

                  if (isConfirmed) {
                    void onRemove(alert.id);
                  }
                }}
                className="text-xs"
                data-testid="remove-alert-button"
              >
                {isRemoving ? <Spinner size="small" /> : <Bin className="text-xs" />}
              </Button>
            </CustomTooltip>
          </div>
        );
      }
    })
  ];

  const table = useReactTable({
    data: visibleData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    state: {
      columnVisibility: {
        enabled: isAlertUpdateEnabled,
        actions: isAlertUpdateEnabled
      },
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.limit
      }
    },
    onPaginationChange: updaterOrValue => {
      const { pageIndex, pageSize } = typeof updaterOrValue === "function" ? updaterOrValue(table.getState().pagination) : updaterOrValue;
      onPaginationChange({
        page: pageIndex + 1,
        limit: pageSize
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="large" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-500">Error loading alerts</p>
      </div>
    );
  }

  if (visibleData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">No alerts found</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} className="h-12">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id} className="h-12 [&>td]:px-4">
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id} className="align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination.total > MIN_PAGE_SIZE && (
        <div className="flex items-center justify-center pt-6">
          <CustomPagination
            totalPageCount={pagination.totalPages}
            pageIndex={pagination.page - 1}
            pageSize={pagination.limit}
            setPageIndex={table.setPageIndex}
            setPageSize={table.setPageSize}
          />
        </div>
      )}
    </>
  );
};
