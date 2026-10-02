import React from "react";
import { FormattedNumber } from "react-intl";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CustomPagination,
  DateRangePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton
} from "@akashnetwork/ui/components";
import type { PaginationState } from "@tanstack/react-table";
import { endOfToday, startOfDay, subYears } from "date-fns";
import { Calendar, Download, Page } from "iconoir-react";

import { HISTORY_DATE_PRESETS, type HistoryDatePreset, type HistoryDateRange } from "@src/components/billing-usage/BillingContainer/historyDatePresets";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import type { BillingTransaction } from "@src/queries";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

export const DEPENDENCIES = {
  FormattedNumber,
  DateRangePicker,
  CustomPagination
};

const TRANSACTION_TYPE_LABELS: Record<BillingTransaction["type"], string> = {
  payment_intent: "Card payment",
  coupon_claim: "Coupon",
  manual_credit: "Manual credit"
};

const STATUS_LABELS: Record<string, string> = {
  succeeded: "Successful",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded"
};

const COLUMN_HEADERS = ["Date", "Amount", "Account source", "Status", "Receipt"];

/** Phones lay a row out as date and amount over source, status and receipt; wider screens give each its own column. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 px-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_72px] sm:gap-y-0";

/** Coupon claims and manual credits top up the wallet, so their amount reads as money in (green +). */
const isCreditTransaction = (type: BillingTransaction["type"]) => type === "coupon_claim" || type === "manual_credit";

export type BillingViewProps = {
  data: BillingTransaction[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage: string | null;
  onExport: () => void;
  onPaginationChange: (state: PaginationState) => void;
  pagination: PaginationState;
  totalCount: number;
  dateRange: HistoryDateRange;
  onDateRangeChange: (range: HistoryDateRange) => void;
  datePreset: HistoryDatePreset;
  onDatePresetChange: (preset: HistoryDatePreset) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const BillingView: React.FC<BillingViewProps> = ({
  data,
  isLoading,
  isFetching,
  errorMessage,
  isError,
  onExport,
  onPaginationChange,
  pagination,
  totalCount,
  dateRange,
  onDateRangeChange,
  datePreset,
  onDatePresetChange,
  dependencies: d = DEPENDENCIES
}) => {
  if (isError) {
    return (
      <SettingsSection title="History">
        <Alert variant="destructive">
          <AlertTitle>Error fetching billing data</AlertTitle>
          <AlertDescription>{errorMessage || "An unexpected error occurred."}</AlertDescription>
        </Alert>
      </SettingsSection>
    );
  }

  const usd = (cents: number, currency: string) => (
    <d.FormattedNumber value={cents / 100} style="currency" currency={currency} currencyDisplay="narrowSymbol" />
  );

  return (
    <SettingsSection title="History">
      <Card className="overflow-hidden rounded-xl shadow-none">
        {isLoading ? (
          <BillingTableSkeleton />
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Page className="h-[22px] w-[22px] text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold">No payments in this period</p>
            <p className="text-xs text-muted-foreground">Payments, coupons and credits added to your balance show up here.</p>
          </div>
        ) : (
          <div role="table" aria-label="Payment history" aria-busy={isFetching} className="transition-opacity duration-150 aria-busy:opacity-60">
            <div role="rowgroup" className="hidden sm:block">
              <div role="row" className={`${ROW_GRID} py-3.5`}>
                {COLUMN_HEADERS.map(header => (
                  <span key={header} role="columnheader" className="text-[13px] font-medium">
                    {header}
                  </span>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {data.map(transaction => (
                <div key={transaction.id} role="row" className={`${ROW_GRID} border-t py-3.5 first:border-t-0 sm:py-4 sm:first:border-t`}>
                  <span role="cell" className="text-sm">
                    {new Date(transaction.created * 1000).toLocaleDateString()}
                  </span>
                  <span role="cell" className="col-span-2 text-right text-sm sm:col-span-1 sm:text-left">
                    <TransactionAmount transaction={transaction} usd={usd} />
                  </span>
                  <span role="cell" className="min-w-0 text-sm">
                    <TransactionSource transaction={transaction} />
                  </span>
                  <span role="cell" className="justify-self-end sm:justify-self-start">
                    <span
                      data-status={transaction.status}
                      className="inline-flex rounded-full bg-muted px-3 py-[3px] text-xs font-medium text-muted-foreground data-[status=failed]:bg-destructive/15 data-[status=pending]:bg-warning/15 data-[status=succeeded]:bg-success/15 data-[status=failed]:text-destructive data-[status=pending]:text-warning data-[status=succeeded]:text-success"
                    >
                      {STATUS_LABELS[transaction.status] ?? capitalizeFirstLetter(transaction.status)}
                    </span>
                  </span>
                  <span role="cell" className="justify-self-end sm:justify-self-start">
                    {transaction.receiptUrl && (
                      <a
                        href={transaction.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View receipt"
                        className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
                      >
                        <Page className="h-[17px] w-[17px]" />
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t px-5 py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {totalCount > 0 && (
              <d.CustomPagination
                totalPageCount={Math.max(1, Math.ceil(totalCount / pagination.pageSize))}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                setPageIndex={pageIndex => onPaginationChange({ pageIndex, pageSize: pagination.pageSize })}
                setPageSize={pageSize => onPaginationChange({ pageIndex: 0, pageSize })}
              />
            )}
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Select value={datePreset} onValueChange={value => onDatePresetChange(value as HistoryDatePreset)}>
                <SelectTrigger aria-label="Date range" className="h-9 w-auto gap-2 text-[13px]">
                  <Calendar className="h-[15px] w-[15px] text-muted-foreground" aria-hidden />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HISTORY_DATE_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={onExport} size="sm" className="h-9 gap-1.5" disabled={!data.length}>
                <Download className="h-[15px] w-[15px]" />
                Export as CSV
              </Button>
            </div>
          </div>
          {datePreset === "custom" && (
            <div className="flex lg:justify-end">
              <d.DateRangePicker
                date={dateRange}
                onChange={onDateRangeChange}
                minDate={startOfDay(subYears(new Date(), 1))}
                maxDate={endOfToday()}
                maxRangeInDays={366}
              />
            </div>
          )}
        </div>
      </Card>
    </SettingsSection>
  );
};

const TransactionAmount: React.FC<{ transaction: BillingTransaction; usd: (cents: number, currency: string) => React.ReactNode }> = ({ transaction, usd }) => {
  const { amount, currency, bonusAmount = 0, amountRefunded = 0, type } = transaction;
  const isCredit = isCreditTransaction(type);

  return (
    <>
      <span data-credit={isCredit || undefined} className="data-[credit]:font-medium data-[credit]:text-success">
        {isCredit && "+"}
        {usd(amount, currency)}
      </span>
      {bonusAmount > 0 && <span className="block text-xs font-medium text-muted-foreground">+{usd(bonusAmount, currency)} bonus</span>}
      {amountRefunded > 0 && <span className="block text-xs font-medium text-muted-foreground">-{usd(amountRefunded, currency)} refunded</span>}
    </>
  );
};

const TransactionSource: React.FC<{ transaction: BillingTransaction }> = ({ transaction }) => {
  const { type, cardBrand, cardLast4, description } = transaction;

  if (cardLast4) {
    return <span className="block truncate">{`${cardBrand ? `${capitalizeFirstLetter(cardBrand)} ` : ""}**** ${cardLast4}`}</span>;
  }

  return (
    <>
      <span className="block truncate">{TRANSACTION_TYPE_LABELS[type] ?? capitalizeFirstLetter(type)}</span>
      {description && (
        <span className="block truncate text-xs text-muted-foreground" title={description}>
          {description}
        </span>
      )}
    </>
  );
};

const BillingTableSkeleton: React.FC = () => (
  <div data-testid="billing-history-skeleton">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className={`${ROW_GRID} border-t py-4 first:border-t-0`}>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="col-span-2 ml-auto h-4 w-16 sm:col-span-1 sm:ml-0" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-6" />
      </div>
    ))}
  </div>
);
