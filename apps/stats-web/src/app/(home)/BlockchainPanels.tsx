"use client";
import { toMessageLabel } from "./dashboardModel";
import { SideRow } from "./SidePanels";

import { Link } from "@/components/Link/Link";
import { Eyebrow, MeterBar, Panel, PanelTitle } from "@/components/stats/Panel";
import { useNow } from "@/hooks/useNow";
import { formatAgo, formatCompact, formatHash, formatNumber, formatPercent } from "@/lib/statsFormat/statsFormat";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import { useBlocks, useTransactions } from "@/queries";
import type { Block, DashboardData, TransactionDetail } from "@/types";

const RELATIVE_TIME_REFRESH_MS = 5000;
const LATEST_REFRESH_INTERVAL_MS = 7000;
const LATEST_ROW_LIMIT = 8;

export function LatestBlocksPanel() {
  const now = useNow(RELATIVE_TIME_REFRESH_MS);
  const { data: blocks } = useBlocks(LATEST_ROW_LIMIT, { refetchInterval: LATEST_REFRESH_INTERVAL_MS });

  return (
    <Panel className="flex flex-col px-5 py-5 sm:px-6">
      <div className="flex items-baseline justify-between pb-2.5">
        <PanelTitle>Latest blocks</PanelTitle>
        <Link href={UrlService.blocks()} className="text-xs font-medium text-muted-foreground hover:text-akash hover:no-underline">
          All blocks →
        </Link>
      </div>
      {!blocks && <RowsSkeleton />}
      {blocks?.map((block: Block) => (
        <div key={block.height} className="grid grid-cols-[100px_minmax(0,1fr)_56px_64px] items-center gap-2.5 border-b border-muted py-2 leading-none">
          <Link href={UrlService.block(block.height)} className="font-mono text-xs font-medium text-foreground hover:text-akash hover:no-underline">
            {formatNumber(block.height)}
          </Link>
          <Link
            href={UrlService.validator(block.proposer.operatorAddress)}
            className="truncate text-xs text-muted-foreground hover:text-akash hover:no-underline"
          >
            {block.proposer.moniker}
          </Link>
          <span className="text-right font-mono text-[11px] text-muted-foreground">{block.transactionCount} txs</span>
          <span className="text-right font-mono text-[11px] text-faint">{formatAgo(new Date(block.datetime).getTime(), now)}</span>
        </div>
      ))}
    </Panel>
  );
}

export function LatestTransactionsPanel() {
  const now = useNow(RELATIVE_TIME_REFRESH_MS);
  const { data: transactions } = useTransactions(LATEST_ROW_LIMIT, { refetchInterval: LATEST_REFRESH_INTERVAL_MS });

  return (
    <Panel className="flex flex-col px-5 py-5 sm:px-6">
      <div className="flex items-baseline justify-between pb-2.5">
        <PanelTitle>Latest transactions</PanelTitle>
        <Link href={UrlService.transactions()} className="text-xs font-medium text-muted-foreground hover:text-akash hover:no-underline">
          All transactions →
        </Link>
      </div>
      {!transactions && <RowsSkeleton />}
      {transactions?.map((transaction: TransactionDetail) => (
        <div
          key={transaction.hash}
          className="grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-2.5 border-b border-muted py-2 leading-none sm:grid-cols-[96px_minmax(0,1fr)_88px_64px]"
        >
          <Link href={UrlService.transaction(transaction.hash)} className="font-mono text-xs text-muted-foreground hover:text-akash hover:no-underline">
            {formatHash(transaction.hash)}
          </Link>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn("h-[5px] w-[5px] flex-none rounded-full", transaction.isSuccess ? "bg-muted-foreground" : "bg-akash")} aria-hidden />
            <span className="truncate rounded border px-1.5 py-1 font-mono text-[10px] font-medium tracking-[0.04em] text-foreground">
              {toMessageLabel(transaction)}
            </span>
            {transaction.messages.length > 1 && <span className="font-mono text-[10px] text-faint">+{transaction.messages.length - 1}</span>}
          </div>
          <span className="hidden text-right font-mono text-[11px] text-muted-foreground sm:block">{(transaction.fee / 1e6).toFixed(4)} AKT</span>
          <span className="text-right font-mono text-[11px] text-faint">{formatAgo(new Date(transaction.datetime).getTime(), now)}</span>
        </div>
      ))}
    </Panel>
  );
}

export function ChainPanel({ chainStats, className }: { chainStats: DashboardData["chainStats"] | undefined; className?: string }) {
  const bondedShare = chainStats?.totalSupply ? (chainStats.bondedTokens / chainStats.totalSupply) * 100 : 0;

  return (
    <Panel className={cn("flex flex-col px-[22px] py-5", className)}>
      <Eyebrow className="pb-1.5">The chain, right now</Eyebrow>
      <SideRow label="Block height" value={formatNumber(chainStats?.height)} />
      <SideRow label="Total transactions" value={formatCompact(chainStats?.transactionCount)} />
      <SideRow label="Staking APR" value={formatPercent(chainStats?.stakingAPR !== undefined ? chainStats.stakingAPR * 100 : undefined)} />
      <SideRow label="Inflation" value={formatPercent(chainStats && chainStats.inflation * 100)} muted />
      <SideRow label="Community pool" value={`${formatCompact(chainStats && chainStats.communityPool / 1e6)} AKT`} muted />
      <div className="flex flex-col gap-[7px] pt-3">
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Bonded</span>
          <span className="whitespace-nowrap font-mono font-medium">
            {formatCompact(chainStats && chainStats.bondedTokens / 1e6)} / {formatCompact(chainStats && chainStats.totalSupply / 1e6)} AKT
          </span>
        </div>
        <MeterBar percent={bondedShare} className="h-[5px]" />
      </div>
    </Panel>
  );
}

function RowsSkeleton() {
  return (
    <>
      {Array.from({ length: LATEST_ROW_LIMIT }, (_, index) => (
        <div key={index} className="my-1.5 h-5 animate-pulse rounded bg-nested" />
      ))}
    </>
  );
}
