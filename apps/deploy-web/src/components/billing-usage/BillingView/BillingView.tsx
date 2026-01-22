import React from "react";
import { FormattedNumber } from "react-intl";
import type { Charge } from "@akashnetwork/http-sdk";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  CustomTooltip,
  DateRangePicker,
  Label,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSizeSelector,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { PaginationState } from "@tanstack/react-table";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { endOfToday, startOfDay, subYears } from "date-fns";
import { Download, Page } from "iconoir-react";
import Link from "next/link";

import { Title } from "@src/components/shared/Title";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

export const COMPONENTS = {
  FormattedNumber,
  DateRangePicker,
  PaginationSizeSelector
};

export type BillingViewProps = {
  data: Charge[];
  hasMore: boolean;
  hasPrevious: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage: string | null;
  onExport: () => void;
  onPaginationChange: (state: PaginationState) => void;
  pagination: PaginationState;
  totalCount: number;
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  components?: typeof COMPONENTS;
};

export const BillingView: React.FC<BillingViewProps> = ({
  data,
  hasMore,
  hasPrevious,
  isFetching,
  errorMessage,
  isError,
  onExport,
  onPaginationChange,
  pagination,
  dateRange,
  onDateRangeChange,
  components: { FormattedNumber, DateRangePicker, PaginationSizeSelector } = COMPONENTS
}) => {
  const oneYearAgo = startOfDay(subYears(new Date(), 1));
  const columnHelper = createColumnHelper<Charge>();

  const columns = [
    columnHelper.accessor("created", {
      header: "Date",
      cell: info => new Date(info.getValue() * 1000).toLocaleDateString()
    }),
    columnHelper.accessor("amount", {
      header: "Amount",
      cell: info => <FormattedNumber value={info.getValue() / 100} style="currency" currency={info.row.original.currency} currencyDisplay="narrowSymbol" />
    }),
    columnHelper.accessor("paymentMethod.card.brand", {
      header: "Account source",
      cell: info => {
        const { card } = info.row.original.paymentMethod;
        if (!card) return "N/A";
        return `${capitalizeFirstLetter(card.brand)} **** ${card.last4}`;
      }
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: info => (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold",
            info.getValue() === "succeeded"
              ? "bg-green-100 text-green-800"
              : info.getValue() === "pending"
                ? "bg-yellow-100 text-yellow-800"
                : info.getValue() === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
          )}
        >
          {capitalizeFirstLetter(info.getValue())}
        </div>
      )
    }),
    columnHelper.display({
      id: "receipt",
      header: "Receipt",
      cell: info => (
        <CustomTooltip title={<p className="text-sm">View Receipt on Stripe</p>}>
          <Link href={info.row.original.receiptUrl || "#"} target="_blank" rel="noopener noreferrer">
            <Button size="icon" variant="ghost" className="text-black hover:bg-primary hover:text-white dark:text-white">
              <Page width={16} />
            </Button>
          </Link>
        </CustomTooltip>
      )
    })
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    state: {
      pagination
    },
    onPaginationChange: updaterOrValue => {
      const { pageIndex, pageSize } = typeof updaterOrValue === "function" ? updaterOrValue(table.getState().pagination) : updaterOrValue;
      onPaginationChange({
        pageIndex,
        pageSize
      });
    }
  });

  if (isFetching) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error fetching billing data</AlertTitle>
        <AlertDescription>{errorMessage || "An unexpected error occurred."}</AlertDescription>
      </Alert>
    );
  }

  const columnClasses = ["w-32 px-4 py-2", "w-32 px-4 py-2", "w-32 px-4 py-2", "w-32 px-4 py-2", "w-4 px-4 py-2"];

  return (
    <div className="space-y-2">
      <Title subTitle>History</Title>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Label>Filter by Date:</Label>
          <DateRangePicker date={dateRange} onChange={onDateRangeChange} className="w-full" minDate={oneYearAgo} maxDate={endOfToday()} maxRangeInDays={366} />
        </div>

        <Button variant="outline" onClick={onExport} size="sm" className="gap-2" disabled={!data.length || !dateRange.from || !dateRange.to}>
          <Download width={16} />
          Export as CSV
        </Button>
      </div>

      {!data.length && (
        <div className="py-8 text-center text-muted-foreground">
          <p>No billing history found for the selected date range.</p>
        </div>
      )}

      {!!data.length && (
        <div>
          <Table className="table-fixed">
            <TableHeader className="[&_tr]:border-b-0">
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header, index) => (
                    <TableHead key={header.id} className={columnClasses[index]}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
          </Table>

          <div className="rounded border border-muted-foreground/20">
            <Table className="table-fixed">
              <TableBody>
                {table.getRowModel().rows.map(row => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell key={cell.id} className={columnClasses[index]}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination className="flex flex-col justify-start gap-2 pt-2 sm:flex-row sm:items-center sm:gap-0 sm:pt-6">
            <PaginationSizeSelector
              pageSize={pagination.pageSize}
              setPageSize={pageSize => {
                onPaginationChange({
                  pageIndex: 0,
                  pageSize
                });
              }}
            />

            <PaginationContent className="flex items-center space-x-1">
              <PaginationItem className="hidden sm:list-item">
                <PaginationPrevious
                  onClick={() =>
                    onPaginationChange({
                      pageIndex: Math.max(0, pagination.pageIndex - 1),
                      pageSize: pagination.pageSize
                    })
                  }
                  disabled={!hasPrevious || isFetching}
                  className="h-8 px-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 [&_span]:hidden sm:[&_span]:inline-block"
                />
              </PaginationItem>

              {hasPrevious && (
                <PaginationItem>
                  <PaginationLink
                    className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                    disabled={isFetching}
                    onClick={() =>
                      onPaginationChange({
                        pageIndex: pagination.pageIndex - 1,
                        pageSize: pagination.pageSize
                      })
                    }
                  >
                    {pagination.pageIndex}
                  </PaginationLink>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationLink disabled className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300">
                  {pagination.pageIndex + 1}
                </PaginationLink>
              </PaginationItem>

              {hasMore && (
                <PaginationItem>
                  <PaginationLink
                    className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                    disabled={isFetching}
                    onClick={() =>
                      onPaginationChange({
                        pageIndex: pagination.pageIndex + 1,
                        pageSize: pagination.pageSize
                      })
                    }
                  >
                    {pagination.pageIndex + 2}
                  </PaginationLink>
                </PaginationItem>
              )}

              {pagination.pageIndex === 0 && hasMore && (
                <>
                  <PaginationItem>
                    <PaginationLink
                      className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                      disabled={isFetching}
                      onClick={() =>
                        onPaginationChange({
                          pageIndex: 2,
                          pageSize: pagination.pageSize
                        })
                      }
                    >
                      3
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationEllipsis className="text-neutral-500 dark:text-neutral-400" />
                </>
              )}

              <PaginationItem className="hidden sm:list-item">
                <PaginationNext
                  onClick={() => onPaginationChange({ pageIndex: pagination.pageIndex + 1, pageSize: pagination.pageSize })}
                  disabled={!hasMore || isFetching}
                  className="h-8 px-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 [&_span]:hidden sm:[&_span]:inline-block"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};
