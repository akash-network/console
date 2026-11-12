"use client";
import { useState } from "react";

import type { MigrationTransferRow } from "./solanaMigrationModel";
import { MIGRATION_TRANSFER_SORTS, MIGRATION_TRANSFERS_PAGE_SIZE, nextTransfersLimit, toMigrationTransferRows } from "./solanaMigrationModel";

import { Link } from "@/components/Link/Link";
import { Eyebrow, LoadError, Panel, PanelTitle } from "@/components/stats/Panel";
import { SegmentedTabs } from "@/components/stats/Toggles";
import { formatAgo, formatNumber } from "@/lib/statsFormat/statsFormat";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import { useSinkTransfers } from "@/queries";
import type { SinkTransferSort } from "@/types";

const ROW_COLUMNS = "grid grid-cols-[minmax(0,1fr)_112px_104px] items-center gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_128px_112px_72px_56px] sm:gap-4";

export function MigrationTransfersPanel({ now, refetchInterval, className }: { now: number; refetchInterval: number; className?: string }) {
  const [sort, setSort] = useState<SinkTransferSort>("latest");
  const [limit, setLimit] = useState(MIGRATION_TRANSFERS_PAGE_SIZE);
  const { data, isError, refetch } = useSinkTransfers(sort, limit, { refetchInterval });
  const rows = data && toMigrationTransferRows(data.results);
  const nextLimit = nextTransfersLimit(limit, data?.count);
  const showFirstPageSortedBy = (nextSort: SinkTransferSort) => {
    setSort(nextSort);
    setLimit(MIGRATION_TRANSFERS_PAGE_SIZE);
  };

  return (
    <Panel className={cn("flex flex-col px-5 py-5 sm:px-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-baseline gap-2.5">
          <PanelTitle>{MIGRATION_TRANSFER_SORTS.find(option => option.value === sort)?.title}</PanelTitle>
          {data && <span className="font-mono text-[11px] text-faint">{formatNumber(data.count)} total</span>}
        </div>
        <SegmentedTabs options={MIGRATION_TRANSFER_SORTS} value={sort} onChange={showFirstPageSortedBy} label="Transfer order" />
      </div>

      {!rows && (isError ? <LoadError subject="the transfers" onRetry={() => refetch()} /> : <RowsSkeleton />)}
      {rows?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No transfers yet.</p>}
      {!!rows?.length && (
        <>
          <div className={cn(ROW_COLUMNS, "border-b border-muted pb-2.5")}>
            <Eyebrow className="text-[10px]">From</Eyebrow>
            <Eyebrow className="hidden text-[10px] sm:block">To on Solana</Eyebrow>
            <Eyebrow className="text-right text-[10px]">Amount</Eyebrow>
            <Eyebrow className="text-[10px]">Status</Eyebrow>
            <Eyebrow className="hidden text-right text-[10px] sm:block">Mint time</Eyebrow>
            <Eyebrow className="hidden text-right text-[10px] sm:block">Created</Eyebrow>
          </div>
          {rows.map(row => (
            <TransferRow key={row.key} row={row} now={now} />
          ))}
        </>
      )}

      {nextLimit && (
        <button
          type="button"
          onClick={() => setLimit(nextLimit)}
          className="self-center pt-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground hover:text-akash"
        >
          Show more
        </button>
      )}
    </Panel>
  );
}

function TransferRow({ row, now }: { row: MigrationTransferRow; now: number }) {
  return (
    <div className={cn(ROW_COLUMNS, "border-b border-muted py-2 leading-none")}>
      <Link
        href={UrlService.address(row.owner)}
        title={row.owner}
        className="truncate font-mono text-xs font-medium text-foreground hover:text-akash hover:no-underline"
      >
        {row.ownerLabel}
      </Link>
      <span title={row.recipient} className="hidden truncate font-mono text-xs text-muted-foreground sm:block">
        {row.recipientLabel}
      </span>
      <span className="whitespace-nowrap text-right font-mono text-xs font-medium tabular-nums">{row.amount}</span>
      <span
        className={cn(
          "justify-self-start whitespace-nowrap rounded border px-1.5 py-1 font-mono text-[10px] font-medium tracking-[0.04em]",
          row.isMinted ? "text-muted-foreground" : "border-border-strong text-foreground"
        )}
      >
        {row.statusLabel}
      </span>
      <span className="hidden text-right font-mono text-[11px] text-muted-foreground sm:block">{row.timeToMint}</span>
      <Link
        href={UrlService.block(row.height)}
        title={`Block ${formatNumber(row.height)}`}
        className="hidden text-right font-mono text-[11px] text-faint hover:text-akash hover:no-underline sm:block"
      >
        {formatAgo(row.createdAt, now)}
      </Link>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <>
      {Array.from({ length: MIGRATION_TRANSFERS_PAGE_SIZE }, (_, index) => (
        <div key={index} className="my-1.5 h-5 animate-pulse rounded bg-nested" />
      ))}
    </>
  );
}
