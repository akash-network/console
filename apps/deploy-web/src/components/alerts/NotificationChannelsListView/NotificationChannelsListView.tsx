import type { FC } from "react";
import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import {
  Button,
  buttonVariants,
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
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Bin, Edit } from "iconoir-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

type NotificationChannel = components["schemas"]["NotificationChannelOutput"]["data"];
type NotificationChannelsInput = components["schemas"]["NotificationChannelListOutput"]["data"];
type NotificationChannelsPagination = components["schemas"]["NotificationChannelListOutput"]["pagination"];

export type NotificationChannelsListViewProps = {
  data: NotificationChannelsInput;
  pagination: Pick<NotificationChannelsPagination, "page" | "limit" | "total" | "totalPages">;
  isLoading: boolean;
  removingIds: Set<NotificationChannel["id"]>;
  onRemove: (id: NotificationChannel["id"]) => Promise<void>;
  onPaginationChange: (state: { page: number; limit: number }) => void;
  isError: boolean;
};

export const NotificationChannelsListView: FC<NotificationChannelsListViewProps> = ({
  data,
  pagination,
  onPaginationChange,
  isLoading,
  removingIds,
  onRemove,
  isError
}) => {
  const { confirm } = usePopup();
  const columnHelper = createColumnHelper<NotificationChannel>();

  const columns = [
    columnHelper.accessor("name", {
      header: () => <div>Name</div>,
      cell: info => <div>{info.getValue()}</div>
    }),
    columnHelper.accessor("type", {
      header: () => <div>Type</div>,
      cell: info => <div>{info.getValue()}</div>
    }),
    columnHelper.accessor("config.addresses", {
      header: () => <div>Addresses</div>,
      cell: info =>
        info.getValue().map(emailAddress => (
          <CustomTooltip key={emailAddress} title={emailAddress}>
            <div className="max-w-48 truncate">{emailAddress}</div>
          </CustomTooltip>
        ))
    }),
    columnHelper.display({
      id: "actions",
      cell: info => {
        const isRemoving = removingIds.has(info.row.original.id);

        return (
          <div className="flex items-center justify-end gap-1">
            <CustomTooltip title="Edit" disabled={isRemoving}>
              <Link
                href={UrlService.notificationChannelDetails(info.row.original.id)}
                color="secondary"
                type="button"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-gray-500 hover:text-gray-700", isRemoving && "pointer-events-none")}
                aria-disabled={isRemoving}
                data-testid="edit-notification-channel-button"
              >
                <Edit className="text-xs" />
              </Link>
            </CustomTooltip>
            <CustomTooltip title="Remove" disabled={isRemoving}>
              <Button
                variant="ghost"
                size="icon"
                disabled={isRemoving}
                onClick={async () => {
                  const isConfirmed = await confirm({
                    title: "Are you sure you want to remove this notification channel?",
                    message: "This action cannot be undone.",
                    testId: "remove-notification-channel-confirmation-popup"
                  });

                  if (isConfirmed) {
                    void onRemove(info.row.original.id);
                  }
                }}
                className="text-sm text-red-500 hover:text-red-700"
                data-testid="remove-notification-channel-button"
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
        <p className="text-red-500">Error loading notification channels</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-gray-500">No notification channels found</p>
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
                <TableCell key={cell.id} className="align-top">
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
