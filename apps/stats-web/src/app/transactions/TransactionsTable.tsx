"use client";
import { useState } from "react";

import { Link } from "@/components/Link/Link";
import { Panel } from "@/components/stats/Panel";
import { useNow } from "@/hooks/useNow";
import type { TransactionGroupKey } from "@/lib/chainActivity/chainActivity";
import { filterTransactionsByGroup, messageTypeName, TRANSACTION_GROUPS } from "@/lib/chainActivity/chainActivity";
import { formatAgo, formatHash, formatNumber } from "@/lib/statsFormat/statsFormat";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/queries";
import type { TransactionDetail } from "@/types";

const TRANSACTION_LIMIT = 100;
const TRANSACTION_REFRESH_INTERVAL_MS = 7000;
const TRANSACTION_COLUMNS =
  "grid grid-cols-[96px_minmax(0,1fr)_64px] gap-3 sm:grid-cols-[110px_minmax(0,1fr)_80px_100px_72px] md:grid-cols-[120px_minmax(0,1fr)_90px_110px_100px_110px]";

export const TransactionsTable: React.FunctionComponent = () => {
  const now = useNow(1000);
  const [groupKey, setGroupKey] = useState<TransactionGroupKey>("all");
  const { data: transactions } = useTransactions(TRANSACTION_LIMIT, { refetchInterval: TRANSACTION_REFRESH_INTERVAL_MS });
  const rows: TransactionDetail[] | undefined = transactions && filterTransactionsByGroup(transactions, groupKey);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em]">Transactions</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
          {rows && groupKey !== "all" ? `${rows.length} of the latest ${transactions?.length}` : `Latest ${transactions?.length ?? TRANSACTION_LIMIT}`} · Live
          from the indexer
        </span>
      </div>

      <div role="group" aria-label="Transaction type" className="flex flex-wrap gap-2">
        {TRANSACTION_GROUPS.map(group => {
          const isSelected = group.key === groupKey;

          return (
            <button
              key={group.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setGroupKey(group.key)}
              className={cn(
                "rounded-full border px-3 py-[7px] font-mono text-[11px] font-medium uppercase leading-none tracking-[0.04em] transition-colors",
                isSelected ? "border-border-strong bg-muted text-foreground" : "text-faint hover:text-foreground"
              )}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      <Panel className="px-4 pb-4 pt-2 sm:px-6">
        <div className={cn(TRANSACTION_COLUMNS, "border-b pb-2.5 pt-3.5 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-faint")}>
          <span>Hash</span>
          <span>Type</span>
          <span className="hidden sm:block">Result</span>
          <span className="hidden text-right sm:block">Height</span>
          <span className="hidden text-right md:block">Fee</span>
          <span className="text-right">Time</span>
        </div>

        {!rows && Array.from({ length: 12 }, (_, index) => <div key={index} className="my-2 h-7 animate-pulse rounded bg-nested" />)}
        {rows?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">None of the latest transactions are of this type.</p>}
        {rows?.map(transaction => (
          <div
            key={transaction.hash}
            className={cn(
              TRANSACTION_COLUMNS,
              "-mx-3 items-center rounded-md border-b border-muted px-3 py-2.5 leading-none transition-colors hover:bg-nested"
            )}
          >
            <Link href={UrlService.transaction(transaction.hash)} className="font-mono text-xs text-muted-foreground hover:text-akash hover:no-underline">
              {formatHash(transaction.hash)}
            </Link>
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate rounded border bg-nested px-[7px] py-[5px] font-mono text-[10px] font-medium tracking-[0.04em] text-foreground">
                {transaction.messages[0]?.isReceiver ? "Receive" : messageTypeName(transaction.messages[0]?.type ?? "")}
              </span>
              {transaction.messages.length > 1 && <span className="font-mono text-[10px] text-faint">+{transaction.messages.length - 1}</span>}
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className={cn("h-[5px] w-[5px] rounded-full", transaction.isSuccess ? "bg-muted-foreground" : "bg-akash")} aria-hidden />
              <span className={cn("font-mono text-[11px]", transaction.isSuccess ? "text-muted-foreground" : "text-akash")}>
                {transaction.isSuccess ? "Success" : "Failed"}
              </span>
            </div>
            <Link
              href={UrlService.block(transaction.height)}
              className="hidden text-right font-mono text-xs text-muted-foreground hover:text-akash hover:no-underline sm:block"
            >
              {formatNumber(transaction.height)}
            </Link>
            <span className="hidden text-right font-mono text-xs text-muted-foreground md:block">{(transaction.fee / 1e6).toFixed(4)} AKT</span>
            <span className="text-right font-mono text-xs text-faint">{formatAgo(new Date(transaction.datetime).getTime(), now)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
};
