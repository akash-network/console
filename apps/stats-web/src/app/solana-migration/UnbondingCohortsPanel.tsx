"use client";
import type { UnbondingCohortRow } from "./migrationMilestonesModel";

import { Eyebrow, LoadError, Panel, PanelTitle } from "@/components/stats/Panel";
import { cn } from "@/lib/utils";

const ROW_COLUMNS = "grid grid-cols-[minmax(0,1fr)_88px_80px] items-center gap-2.5 sm:grid-cols-[minmax(0,1fr)_96px_96px_96px_96px_96px_88px] sm:gap-4";

export function UnbondingCohortsPanel({
  rows,
  isLoading,
  isError,
  onRetry,
  className
}: {
  rows: UnbondingCohortRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  className?: string;
}) {
  if (!isLoading && !isError && !rows.length) return null;

  return (
    <Panel className={cn("flex flex-col px-5 py-5 sm:px-6", className)}>
      <div className="flex flex-col gap-1 pb-3">
        <PanelTitle>Who is migrating</PanelTitle>
        <span className="text-xs text-muted-foreground">
          Delegators grouped by when they first unstaked. Share sent counts AKT sent to Solana after unstaking, up to what has finished unbonding.
        </span>
      </div>

      {isError && !rows.length && <LoadError subject="the unstaking cohorts" onRetry={onRetry} />}
      {isLoading && !rows.length && <div className="h-40 animate-pulse rounded-md bg-nested" />}
      {!!rows.length && (
        <div role="table" aria-label="Unstaking cohorts">
          <div role="row" className={cn(ROW_COLUMNS, "border-b border-muted pb-2.5")}>
            <Eyebrow className="text-[10px]">
              <span role="columnheader">First unstaked</span>
            </Eyebrow>
            <HeaderCell className="hidden sm:block">Delegators</HeaderCell>
            <HeaderCell>Unstaked</HeaderCell>
            <HeaderCell className="hidden sm:block">Liquid</HeaderCell>
            <HeaderCell className="hidden sm:block">Migrating</HeaderCell>
            <HeaderCell className="hidden sm:block">Sent</HeaderCell>
            <HeaderCell>Share sent</HeaderCell>
          </div>
          {rows.map(row => (
            <CohortRow key={row.key} row={row} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function HeaderCell({ className, children }: { className?: string; children: string }) {
  return (
    <Eyebrow className={cn("text-right text-[10px]", className)}>
      <span role="columnheader">{children}</span>
    </Eyebrow>
  );
}

function CohortRow({ row }: { row: UnbondingCohortRow }) {
  return (
    <div role="row" className={cn(ROW_COLUMNS, "border-b border-muted py-2.5 last:border-b-0")}>
      <div role="rowheader" className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{row.name}</span>
        {row.period && <span className="font-mono text-[11px] text-faint">{row.period}</span>}
      </div>
      <Cell className="hidden sm:block">{row.delegators}</Cell>
      <Cell>{row.unbonded}</Cell>
      <Cell className={cn("hidden sm:block", !row.isLiquid && "text-muted-foreground")}>{row.liquid}</Cell>
      <Cell className="hidden sm:block">{row.senders}</Cell>
      <Cell className="hidden sm:block">{row.sent}</Cell>
      <Cell className={cn("font-semibold", row.isLiquid ? "text-foreground" : "text-muted-foreground")}>{row.shareSent}</Cell>
    </div>
  );
}

function Cell({ className, children }: { className?: string; children: string }) {
  return (
    <span role="cell" className={cn("whitespace-nowrap text-right font-mono text-xs tabular-nums", className)}>
      {children}
    </span>
  );
}
