"use client";

import * as React from "react";
import {
  ColumnDef,
  AccessorColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { DataTableToolbar } from "./data-table-toolbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { DataTablePagination } from "./data-table-pagination";
import { SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import Spinner from "../shared/Spinner";

interface DataTableProps<TData, TValue> {
  columns: AccessorColumnDef<TData, TValue>[];
  data: TData[];
  manualPagniation?: boolean;
  manualFiltering?: boolean;
  manualSorting?: boolean;
  pageCount?: number;
  hasTextFilter?: boolean;
  isLoading?: boolean;
  noResultsText?: string;
  hasRowSelection?: boolean;
  initialPageSize?: number;
  hasStatusFilter?: boolean;
  onColumnFiltersChange?: (columnFilters: ColumnFiltersState) => void;
  onColumnSortingChange?: (sorting: SortingState) => void;
  setPageSize?: (pageSize: number) => void;
  setPageIndex?: (pageIndex: number) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  manualPagniation,
  manualFiltering,
  manualSorting,
  pageCount,
  isLoading,
  noResultsText,
  hasRowSelection,
  hasStatusFilter,
  initialPageSize = 10,
  onColumnFiltersChange,
  onColumnSortingChange,
  setPageIndex,
  setPageSize
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [_pageCount, setPageCount] = useState<number>(0);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: initialPageSize });
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination
    },
    enableRowSelection: true,
    manualPagination: manualPagniation,
    pageCount: _pageCount,
    manualFiltering: manualFiltering,
    manualSorting: manualSorting,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onPaginationChange: onPaginationChange
  });

  function onPaginationChange(updater: Updater<PaginationState>) {
    // TODO fix typing
    const nextState = (updater as any)(pagination);

    setPageIndex && setPageIndex(nextState.pageIndex);
    setPageSize && setPageSize(nextState.pageSize);

    setPagination(nextState);
  }

  useEffect(() => {
    if (pageCount !== undefined) {
      setPageCount(pageCount || 0);
    }
  }, [pageCount]);

  useEffect(() => {
    if (onColumnSortingChange) {
      onColumnSortingChange(sorting);

      table.resetPageIndex();
    }
  }, [sorting]);

  useEffect(() => {
    if (manualFiltering && onColumnFiltersChange) {
      onColumnFiltersChange(columnFilters);

      table.resetPageIndex();
    }
  }, [columnFilters]);

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} hasStatusFilter={hasStatusFilter} />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length > 0 &&
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && table.getRowModel().rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="m-auto flex items-center justify-center p-4">
                    <SearchX size="1rem" />
                    &nbsp;
                    {noResultsText ? noResultsText : "No results."}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {isLoading && table.getRowModel().rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex items-center justify-center p-4">
                    <Spinner size="large" />
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {_pageCount > 0 && <DataTablePagination table={table} hasRowSelection={hasRowSelection} />}
    </div>
  );
}
