import type { FC } from "react";
import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import {
  Button,
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
import { Chip } from "@mui/material";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Bin, Check } from "iconoir-react";
import { capitalize, startCase } from "lodash";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

type Alert = components["schemas"]["AlertOutputResponse"]["data"];
type AlertsInput = components["schemas"]["AlertListOutputResponse"]["data"];
type AlertsPagination = components["schemas"]["AlertListOutputResponse"]["pagination"];

export type AlertsListViewProps = {
  data: AlertsInput;
  pagination: Pick<AlertsPagination, "page" | "limit" | "total" | "totalPages">;
  isLoading: boolean;
  removingIds: Set<Alert["id"]>;
  onRemove: (id: Alert["id"]) => Promise<void>;
  onPaginationChange: (state: { page: number; limit: number }) => void;
  isError: boolean;
};

export const AlertsListView: FC<AlertsListViewProps> = ({ data, pagination, onPaginationChange, isLoading, removingIds, onRemove, isError }) => {
  const { confirm } = usePopup();
  const columnHelper = createColumnHelper<Alert>();

  const columns = [
    columnHelper.accessor("name", {
      header: () => <div>Name</div>,
      cell: info => <div>{info.getValue()}</div>
    }),
    columnHelper.accessor("type", {
      header: () => <div>Type</div>,
      cell: info => <div>{startCase(info.getValue().toLowerCase())}</div>
    }),
    columnHelper.accessor("status", {
      header: () => <div>Status</div>,
      cell: info => <Chip color={info.getValue() === "NORMAL" ? "success" : "error"} label={capitalize(info.getValue())} />
    }),
    columnHelper.accessor("params", {
      header: () => <div className="w-32">DSEQ</div>,
      cell: info => {
        const params = info.getValue();

        return params ? (
          <div className="flex max-w-48 items-center gap-1">
            <Link href={UrlService.deploymentDetails(params.dseq, "ALERTS")} className="truncate">
              {params.dseq}
            </Link>
          </div>
        ) : (
          <div className="text-gray-500">No parameters</div>
        );
      }
    }),
    columnHelper.accessor("enabled", {
      header: () => <div>Enabled</div>,
      cell: info => {
        const enabled = info.getValue();

        if (enabled) {
          return <Check data-testid="alert-enabled-checkmark" className="text-sm text-green-600" />;
        }
      }
    }),
    columnHelper.display({
      id: "actions",
      cell: info => {
        const isRemoving = removingIds.has(info.row.original.id);

        return (
          <div className="flex items-center justify-end gap-1">
            <CustomTooltip title="Remove" disabled={isRemoving}>
              <Button
                variant="ghost"
                size="icon"
                disabled={isRemoving}
                onClick={async () => {
                  const isConfirmed = await confirm({
                    title: "Are you sure you want to remove this alert?",
                    message: "This action cannot be undone.",
                    testId: "remove-alert-confirmation-popup"
                  });

                  if (isConfirmed) {
                    void onRemove(info.row.original.id);
                  }
                }}
                className="text-sm text-red-500 hover:text-red-700"
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
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    state: {
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
                <TableHead key={header.id} className="w-1/4">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id} className="[&>td]:px-4 [&>td]:py-2">
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
