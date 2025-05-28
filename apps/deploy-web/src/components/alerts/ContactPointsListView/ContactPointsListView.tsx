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
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Bin, Edit } from "iconoir-react";

import type { ContactPoint } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";

type ContactPointsInput = components["schemas"]["ContactPointListOutput"]["data"];
type ContactPointsPagination = components["schemas"]["ContactPointListOutput"]["pagination"];

export type ContactPointsListViewProps = {
  data: ContactPointsInput;
  pagination: Pick<ContactPointsPagination, "page" | "limit" | "total" | "totalPages">;
  isLoading: boolean;
  idsBeingRemoved: Set<ContactPoint["id"]>;
  onEdit: (id: ContactPoint["id"]) => void;
  onRemove: (id: ContactPoint["id"]) => Promise<void>;
  onPageChange: (page: number, limit: number) => void;
  isError: boolean;
};

export const ContactPointsListView: FC<ContactPointsListViewProps> = ({
  data,
  pagination,
  onPageChange,
  isLoading,
  onEdit,
  idsBeingRemoved,
  onRemove,
  isError
}) => {
  const { confirm } = usePopup();
  const columnHelper = createColumnHelper<ContactPoint>();

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
        const isBeingRemoved = idsBeingRemoved.has(info.row.original.id);

        return (
          <div className="flex items-center justify-end gap-1">
            <CustomTooltip title="Edit" disabled={isBeingRemoved}>
              <Button
                variant="ghost"
                disabled={isBeingRemoved}
                size="icon"
                onClick={() => onEdit(info.row.original.id)}
                className="text-sm text-gray-500 hover:text-gray-700"
                data-testid="edit-contact-point-button"
              >
                <Edit className="text-xs" />
              </Button>
            </CustomTooltip>
            <CustomTooltip title="Remove" disabled={isBeingRemoved}>
              <Button
                variant="ghost"
                size="icon"
                disabled={isBeingRemoved}
                onClick={async () => {
                  const isConfirmed = await confirm({
                    title: "Are you sure you want to remove this contact point?",
                    message: "This action cannot be undone.",
                    testId: "remove-contact-point-confirmation-popup"
                  });

                  if (isConfirmed) {
                    void onRemove(info.row.original.id);
                  }
                }}
                className="text-sm text-red-500 hover:text-red-700"
                data-testid="remove-contact-point-button"
              >
                {isBeingRemoved ? <Spinner size="small" /> : <Bin className="text-xs" />}
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
      const tablePagination = typeof updaterOrValue === "function" ? updaterOrValue(table.getState().pagination) : updaterOrValue;
      onPageChange(tablePagination.pageIndex, tablePagination.pageSize);
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
        <p className="text-red-500">Error loading contact points</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-gray-500">No contact points found</p>
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
