import React, { useMemo } from "react";
import type { BmeLedgerRecord } from "@akashnetwork/http-sdk";
import { CustomPagination, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useBlock } from "@src/queries/useBlocksQuery";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { averageBlockTime } from "@src/utils/priceUtils";

const PAGE_SIZE = 10;

export const DEPENDENCIES = {
  useBlock
};

interface LedgerRecordsTableProps {
  records: BmeLedgerRecord[];
  isLoading: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const LedgerRecordsTable: React.FC<LedgerRecordsTableProps> = ({ records, isLoading, dependencies: d = DEPENDENCIES }) => {
  const { data: latestBlock } = d.useBlock("latest", { refetchInterval: 30000 });
  const latestHeight = latestBlock ? parseInt(latestBlock.block.header.height) : undefined;
  const latestBlockTime = latestBlock?.block.header.time as string | undefined;

  const columns = useMemo(() => createColumns(latestHeight, latestBlockTime), [latestHeight, latestBlockTime]);
  const sortedRecords = useMemo(() => [...records].sort((a, b) => parseInt(b.id.height) - parseInt(a.id.height)), [records]);

  const table = useReactTable({
    data: sortedRecords,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } }
  });

  if (isLoading && !records.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="medium" />
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <p>No mint or burn history yet.</p>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} className="h-8 px-2 text-xs">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id} className="[&>td]:px-2 [&>td]:py-3">
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-center pt-3">
          <CustomPagination
            totalPageCount={table.getPageCount()}
            setPageIndex={table.setPageIndex}
            pageIndex={table.getState().pagination.pageIndex}
            pageSize={table.getState().pagination.pageSize}
            setPageSize={table.setPageSize}
          />
        </div>
      )}
    </div>
  );
};

const columnHelper = createColumnHelper<BmeLedgerRecord>();

function createColumns(latestHeight?: number, latestBlockTime?: string) {
  return [
    columnHelper.display({
      id: "date",
      header: "Date",
      cell: info => {
        if (!latestHeight || !latestBlockTime) return "-";
        const date = estimateRecordDate(parseInt(info.row.original.id.height), latestHeight, latestBlockTime);
        return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      }
    }),
    columnHelper.display({
      id: "type",
      header: "Type",
      cell: info => {
        const type = getRecordType(info.row.original);
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              type === "Mint" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
            )}
          >
            {type}
          </span>
        );
      }
    }),
    columnHelper.display({
      id: "amountIn",
      header: "Amount In",
      cell: info => {
        const { amount, label } = getAmountIn(info.row.original);
        return amount ? `${amount.toFixed(2)} ${label}` : "-";
      }
    }),
    columnHelper.display({
      id: "amountOut",
      header: "Amount Out",
      cell: info => {
        const { amount, label } = getAmountOut(info.row.original);
        return amount ? `${amount.toFixed(2)} ${label}` : "-";
      }
    }),
    columnHelper.display({
      id: "rate",
      header: "Rate",
      cell: info => {
        const rate = getRate(info.row.original);
        return rate ? rate.toFixed(4) : "-";
      }
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: info => (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", getStatusClasses(info.getValue()))}>
          {getStatusLabel(info.getValue())}
        </span>
      )
    })
  ];
}

function estimateRecordDate(recordHeight: number, latestHeight: number, latestBlockTime: string): Date {
  const blockDiff = latestHeight - recordHeight;
  const secondsAgo = blockDiff * averageBlockTime;
  return new Date(new Date(latestBlockTime).getTime() - secondsAgo * 1000);
}

type RecordType = "Mint" | "Burn";

function getRecordType(record: BmeLedgerRecord): RecordType {
  return record.id.denom === UAKT_DENOM ? "Mint" : "Burn";
}

function getAmountIn(record: BmeLedgerRecord): { amount: number; label: string } {
  const type = getRecordType(record);

  if (record.pending_record) {
    const label = type === "Mint" ? "AKT" : "ACT";
    return { amount: udenomToDenom(parseInt(record.pending_record.coins_to_burn.amount), 6), label };
  }

  if (type === "Mint") {
    const accrued = record.executed_record?.remint_credit_accrued;
    return { amount: accrued ? udenomToDenom(parseInt(accrued.coin.amount), 6) : 0, label: "AKT" };
  }
  const burned = record.executed_record?.burned;
  return { amount: burned ? udenomToDenom(parseInt(burned.coin.amount), 6) : 0, label: "ACT" };
}

function getAmountOut(record: BmeLedgerRecord): { amount: number; label: string } {
  const type = getRecordType(record);
  if (type === "Mint") {
    const minted = record.executed_record?.minted;
    return { amount: minted ? udenomToDenom(parseInt(minted.coin.amount), 6) : 0, label: "ACT" };
  }
  const issued = record.executed_record?.remint_credit_issued;
  return { amount: issued ? udenomToDenom(parseInt(issued.coin.amount), 6) : 0, label: "AKT" };
}

function getRate(record: BmeLedgerRecord): number {
  const type = getRecordType(record);
  if (type === "Mint") {
    const accrued = record.executed_record?.remint_credit_accrued;
    return accrued ? parseFloat(accrued.price) : 0;
  }
  const burned = record.executed_record?.burned;
  return burned ? parseFloat(burned.price) : 0;
}

function getStatusLabel(status: string): string {
  return status.replace("ledger_record_status_", "").replace(/^\w/, c => c.toUpperCase());
}

function getStatusClasses(status: string): string {
  if (status.includes("executed")) return "bg-green-100 text-green-800";
  if (status.includes("pending")) return "bg-yellow-100 text-yellow-800";
  if (status.includes("canceled")) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}
