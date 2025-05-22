import type { FC } from "react";
import React from "react";
import {
  Button,
  CustomPagination,
  CustomTooltip,
  MIN_PAGE_SIZE,
  Popup,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { Bin, Edit } from "iconoir-react";

import type { ContactPoint, ContactPointsListViewProps } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";

export const ContactPointsListView: FC<ContactPointsListViewProps> = ({ data, totalCount, page, limit, onPageChange, isLoading, edit, remove, isError }) => {
  const [contactPointIdToRemove, setContactPointIdToRemove] = React.useState<string | null>(null);
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
      cell: info => (
        <div className="flex items-center justify-end gap-1">
          <CustomTooltip title="Edit">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => edit(info.row.original.id)}
              className="text-sm text-gray-500 hover:text-gray-700"
              data-testid="edit-contact-point-button"
            >
              <Edit className="text-xs" />
            </Button>
          </CustomTooltip>
          <CustomTooltip title="Remove">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setContactPointIdToRemove(info.row.original.id)}
              className="text-sm text-red-500 hover:text-red-700"
              data-testid="remove-contact-point-button"
            >
              <Bin className="text-xs" />
            </Button>
          </CustomTooltip>
        </div>
      )
    })
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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

  const pagination = table.getState().pagination;
  const pageCount = Math.ceil(totalCount / pagination.pageSize);

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

      {totalCount > MIN_PAGE_SIZE && (
        <div className="flex items-center justify-center pt-6">
          <CustomPagination
            totalPageCount={pageCount}
            pageIndex={page - 1}
            pageSize={limit}
            setPageIndex={table.setPageIndex}
            setPageSize={table.setPageSize}
          />
        </div>
      )}

      {contactPointIdToRemove && (
        <Popup
          open
          title="Are you sure you want to remove this contact point?"
          variant="confirm"
          onClose={() => setContactPointIdToRemove(null)}
          onCancel={() => setContactPointIdToRemove(null)}
          onValidate={() => remove(contactPointIdToRemove)}
          enableCloseOnBackdropClick
        >
          This action cannot be undone.
        </Popup>
      )}
    </>
  );
};
