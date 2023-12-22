"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
  flexRender,
  functionalUpdate,
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
import Spinner from "../Spinner";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  manualPagniation?: boolean;
  manualFiltering?: boolean;
  pageCount?: number;
  hasTextFilter?: boolean;
  isLoading?: boolean;
  noResultsText?: string;
  onColumnFiltersChange?: (columnFilters: ColumnFiltersState) => void;
  setPageSize?: (pageSize: number) => void;
  setPageIndex?: (pageIndex: number) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  manualPagniation,
  manualFiltering,
  pageCount,
  isLoading,
  noResultsText,
  onColumnFiltersChange,
  setPageIndex,
  setPageSize
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = React.useState<SortingState>([]);

  function onPaginationChange(updater: Updater<PaginationState>) {
    // TODO fix typing
    const nextState = (updater as any)(pagination);

    console.log(nextState.pageIndex, nextState.pageSize);

    setPageIndex && setPageIndex(nextState.pageIndex);
    setPageSize && setPageSize(nextState.pageSize);

    setPagination(nextState);
  }

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
    pageCount: pageCount,
    manualFiltering: manualFiltering,
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

  React.useEffect(() => {
    if (manualFiltering && onColumnFiltersChange) {
      onColumnFiltersChange(columnFilters);
    }
  }, [columnFilters]);

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
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
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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
      <DataTablePagination table={table} />
    </div>
  );
}
