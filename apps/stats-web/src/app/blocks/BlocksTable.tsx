"use client";
import { Link } from "@/components/Link/Link";
import { LoadError, Panel, StatCard } from "@/components/stats/Panel";
import { useNow } from "@/hooks/useNow";
import { averageBlockTimeSeconds, initialsOf } from "@/lib/chainActivity/chainActivity";
import { EMPTY_VALUE, formatAgo, formatCompact, formatNumber } from "@/lib/statsFormat/statsFormat";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import { useBlocks, useDashboardData } from "@/queries";
import type { Block } from "@/types";

const BLOCK_LIMIT = 20;
const BLOCK_REFRESH_INTERVAL_MS = 7000;
const BLOCK_COLUMNS = "grid grid-cols-[96px_minmax(0,1fr)_48px_72px] gap-3 sm:grid-cols-[130px_minmax(0,1fr)_90px_130px]";

export const BlocksTable: React.FunctionComponent = () => {
  const now = useNow(1000);
  const { data: blocks, isError, refetch } = useBlocks(BLOCK_LIMIT, { refetchInterval: BLOCK_REFRESH_INTERVAL_MS });
  const { data: dashboardData } = useDashboardData();
  const averageBlockTime = blocks && averageBlockTimeSeconds(blocks);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em]">Blocks</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Latest {BLOCK_LIMIT} · Live from the indexer</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Block height" value={formatNumber(blocks?.[0]?.height)} />
        <StatCard label="Avg block time" value={averageBlockTime === undefined ? EMPTY_VALUE : `${averageBlockTime.toFixed(1)}s`} />
        <StatCard label="Total transactions" value={formatCompact(dashboardData?.chainStats?.transactionCount)} />
      </div>

      <Panel className="px-4 pb-4 pt-2 sm:px-6">
        <div className={cn(BLOCK_COLUMNS, "border-b pb-2.5 pt-3.5 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-faint")}>
          <span>Height</span>
          <span>Proposer</span>
          <span className="text-right">Txs</span>
          <span className="text-right">Time</span>
        </div>

        {!blocks && isError && <LoadError subject="blocks" onRetry={() => refetch()} />}
        {!blocks && !isError && Array.from({ length: 12 }, (_, index) => <div key={index} className="my-2 h-7 animate-pulse rounded bg-nested" />)}
        {blocks?.map((block: Block) => (
          <div
            key={block.height}
            className={cn(BLOCK_COLUMNS, "-mx-3 items-center rounded-md border-b border-muted px-3 py-2.5 leading-none transition-colors hover:bg-nested")}
          >
            <Link href={UrlService.block(block.height)} className="font-mono text-[13px] font-medium text-foreground hover:text-akash hover:no-underline">
              {formatNumber(block.height)}
            </Link>
            <Link
              href={UrlService.validator(block.proposer.operatorAddress)}
              className="flex min-w-0 items-center gap-2.5 text-foreground hover:text-akash hover:no-underline"
            >
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-border-strong bg-muted font-mono text-[9px] font-medium text-muted-foreground">
                {initialsOf(block.proposer.moniker)}
              </span>
              <span className="truncate text-[13px]">{block.proposer.moniker}</span>
            </Link>
            <span className={cn("text-right font-mono text-xs", block.transactionCount > 0 ? "text-foreground" : "text-faint")}>{block.transactionCount}</span>
            <span className="text-right font-mono text-xs text-faint">{formatAgo(new Date(block.datetime).getTime(), now)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
};
