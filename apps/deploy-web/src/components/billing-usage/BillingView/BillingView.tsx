import React from "react";
import { FormattedNumber } from "react-intl";
import type { Charge } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DateRangePicker,
  Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { PaginationState } from "@tanstack/react-table";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { endOfToday, startOfDay, subYears } from "date-fns";
import { Download, NavArrowLeft, NavArrowRight, Page } from "iconoir-react";
import Link from "next/link";

import { Title } from "@src/components/shared/Title";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

export const COMPONENTS = {
  FormattedNumber,
  DateRangePicker
};

export type BillingViewProps = {
  data: Charge[];
  hasMore: boolean;
  hasPrevious: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  onPaginationChange: (state: PaginationState) => void;
  pagination: PaginationState;
  totalCount: number;
  dateRange: { from: Date | undefined; to?: Date };
  onDateRangeChange: (range?: { from?: Date; to?: Date }) => void;
  components?: typeof COMPONENTS;
};

export const BillingView: React.FC<BillingViewProps> = ({
  data,
  hasMore,
  hasPrevious,
  isFetching,
  error,
  isError,
  onPaginationChange,
  pagination,
  dateRange,
  onDateRangeChange,
  components: { FormattedNumber, DateRangePicker } = COMPONENTS
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
      cell: info => `${capitalizeFirstLetter(info.getValue())} **** ${info.row.original.paymentMethod.card?.last4}`
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
        <TooltipProvider>
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Link href={info.row.original.receiptUrl || "#"} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="ghost" className="text-black hover:bg-primary hover:text-white dark:text-white">
                  <Page width={16} />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent sideOffset={20}>
              <p className="text-sm">View Receipt on Stripe</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
        <AlertDescription>{error?.message || "An unexpected error occurred."}</AlertDescription>
      </Alert>
    );
  }

  const columnClasses = ["w-32 px-4 py-2", "w-32 px-4 py-2", "w-32 px-4 py-2", "w-32 px-4 py-2", "w-4 px-4 py-2", "w-4 px-4 py-2"];

  const downloadCsv = () => {
    const csvContent = [
      ["Date", "Amount", "Account Source", "Status", "Receipt URL"],
      ...data.map(charge => [
        new Date(charge.created * 1000).toLocaleDateString(),
        `${(charge.amount / 100).toFixed(2)} ${charge.currency}`,
        charge.paymentMethod.card ? `${capitalizeFirstLetter(charge.paymentMethod.card.brand)} **** ${charge.paymentMethod.card.last4}` : "N/A",
        capitalizeFirstLetter(charge.status),
        charge.receiptUrl || ""
      ])
    ]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "billing_history.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-2">
      <Title subTitle>History</Title>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Label>Filter by Date:</Label>
          <DateRangePicker date={dateRange} onChange={onDateRangeChange} className="w-full" minDate={oneYearAgo} maxDate={endOfToday()} maxRangeInDays={366} />
        </div>

        <Button variant="secondary" onClick={downloadCsv} className="h-12 gap-4" disabled={!data.length}>
          <Download width={16} />
          Export as CSV
        </Button>
      </div>

      {!data.length && (
        <div className="text-center text-muted-foreground">
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

          <div className="flex flex-col justify-start gap-2 pt-2 sm:flex-row sm:items-center sm:gap-0 sm:pt-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <select
                value={pagination.pageSize}
                onChange={e =>
                  onPaginationChange({
                    pageIndex: 0,
                    pageSize: Number(e.target.value)
                  })
                }
                className="h-8 w-16 rounded border border-input bg-background px-2 text-sm"
              >
                {[10, 20, 30, 40, 50].map(pageSize => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onPaginationChange({
                    pageIndex: Math.max(0, pagination.pageIndex - 1),
                    pageSize: pagination.pageSize
                  })
                }
                disabled={!hasPrevious || isFetching}
                className="h-8 px-2 text-sm [&_span]:hidden sm:[&_span]:inline-block"
              >
                <NavArrowLeft className="mr-1 h-4 w-4" />
                <span>Previous</span>
              </Button>

              {hasPrevious && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onPaginationChange({
                      pageIndex: pagination.pageIndex - 1,
                      pageSize: pagination.pageSize
                    })
                  }
                  disabled={isFetching}
                  className="h-8 min-w-8 px-2 text-sm"
                >
                  {pagination.pageIndex}
                </Button>
              )}

              <Button variant="outline" size="sm" className="h-8 min-w-8 bg-background px-2 text-sm" disabled>
                {pagination.pageIndex + 1}
              </Button>

              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onPaginationChange({
                      pageIndex: pagination.pageIndex + 1,
                      pageSize: pagination.pageSize
                    })
                  }
                  disabled={isFetching}
                  className="h-8 min-w-8 px-2 text-sm"
                >
                  {pagination.pageIndex + 2}
                </Button>
              )}

              {pagination.pageIndex === 0 && hasMore && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onPaginationChange({
                        pageIndex: 2,
                        pageSize: pagination.pageSize
                      })
                    }
                    disabled={isFetching}
                    className="h-8 min-w-8 px-2 text-sm"
                  >
                    3
                  </Button>
                  <span className="px-1 text-sm text-muted-foreground">...</span>
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onPaginationChange({
                    pageIndex: pagination.pageIndex + 1,
                    pageSize: pagination.pageSize
                  })
                }
                disabled={!hasMore || isFetching}
                className="h-8 px-2 text-sm [&_span]:hidden sm:[&_span]:inline-block"
              >
                <span>Next</span>
                <NavArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
