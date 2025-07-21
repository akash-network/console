import type { FC } from "react";
import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { Checkbox, CustomPagination, MIN_PAGE_SIZE, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
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
  onToggle: (id: string, enabled: boolean) => void;
  loadingIds: Set<string>;
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
  loadingIds,
  isError,
  dependencies: d = DEPENDENCIES
}) => {
  const columnHelper = createColumnHelper<Alert>();
  const isAlertUpdateEnabled = d.useFlag("notifications_general_alerts_update");

  const columns = [
    columnHelper.accessor("enabled", {
      header: "Enabled",
      cell: info => {
        const isToggling = loadingIds.has(info.row.original.id);
        return (
          <div className="flex items-center">
            <Checkbox
              checked={info.getValue()}
              disabled={isToggling}
              onCheckedChange={checked => {
                onToggle(info.row.original.id, !!checked);
              }}
              aria-label={"Toggle alert"}
            />
          </div>
        );
      }
    }),
    columnHelper.accessor("deploymentName", {
      header: "Deployment Name",
      cell: info =>
        info.row.original.params?.dseq ? (
          <Link href={UrlService.deploymentDetails(info.row.original.params.dseq, "ALERTS")} className="font-bold">
            {info.getValue()}
          </Link>
        ) : (
          info.getValue()
        )
    }),
    columnHelper.accessor("params", {
      header: "DSEQ",
      cell: info => {
        const params = info.getValue();
        return params?.dseq ?? "N/A";
      }
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: info => {
        const type = info.getValue();
        const params = info.row.original.params;

        if (type === "DEPLOYMENT_BALANCE") {
          return "Escrow Threshold";
        } else if (params && "type" in params && params.type === "DEPLOYMENT_CLOSED") {
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
    })
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    state: {
      columnVisibility: {
        enabled: isAlertUpdateEnabled
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
      <div className="flex items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-red-500">Error loading alerts</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center">
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
