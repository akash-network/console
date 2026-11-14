"use client";
import { useState } from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, LoadingButton, Progress, Skeleton } from "@akashnetwork/ui/components";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Info, UserPlus } from "lucide-react";

import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import type { AffiliateReferral } from "@src/queries/useAffiliateReferralsQuery";
import { AFFILIATE_REFERRALS_PAGE_SIZE, useAffiliateReferralsQuery } from "@src/queries/useAffiliateReferralsQuery";

export const DEPENDENCIES = {
  SettingsSection,
  FormattedNumber,
  useAffiliateReferralsQuery
};

const COLUMN_HEADERS = ["Referral", "Joined", "Status", "Commission window", "They paid", "You earned"];

/** Phones keep the code, status and earnings on one line; wider screens give each column its own track. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]";

const STATUS_LABELS: Record<AffiliateReferral["status"], string> = {
  paying: "Paying",
  on_trial: "On trial",
  inactive: "Inactive"
};

const STATUS_TONES: Record<AffiliateReferral["status"], "success" | "info" | "muted"> = {
  paying: "success",
  on_trial: "info",
  inactive: "muted"
};

type Props = {
  commissionMonths: number;
  dependencies?: typeof DEPENDENCIES;
};

export function ReferredPeopleList({ commissionMonths, dependencies: d = DEPENDENCIES }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const { data: page, isError, isFetching, refetch } = d.useAffiliateReferralsQuery({ pageIndex });
  const usd = (value: number) => <d.FormattedNumber value={value} style="currency" currency="usd" currencyDisplay="narrowSymbol" />;

  return (
    <d.SettingsSection title="People you referred">
      <Card className="overflow-hidden rounded-xl shadow-none">
        {page ? (
          page.pagination.total === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <UserPlus className="h-[22px] w-[22px] text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">No one has signed up through your link yet.</p>
            </div>
          ) : (
            <div role="table" aria-label="People you referred">
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
                {page.referrals.map(referral => (
                  <div key={referral.code} role="row" className={`${ROW_GRID} border-t py-3.5 text-sm first:border-t-0 sm:py-4 sm:first:border-t`}>
                    <span role="cell" className="font-mono text-[13px]">
                      #{referral.code}
                    </span>
                    <span role="cell" className="hidden sm:block">
                      {format(new Date(referral.joinedAt), "MMM d, yyyy")}
                    </span>
                    <span role="cell">
                      <span
                        data-tone={STATUS_TONES[referral.status]}
                        className="inline-flex rounded-full bg-muted px-3 py-[3px] text-xs font-medium text-muted-foreground data-[tone=info]:bg-blue-50 data-[tone=success]:bg-success/15 data-[tone=info]:text-blue-600 data-[tone=success]:text-success dark:data-[tone=info]:bg-blue-400/10 dark:data-[tone=info]:text-blue-400"
                      >
                        {STATUS_LABELS[referral.status]}
                      </span>
                    </span>
                    <span role="cell" className="hidden items-center gap-2 sm:flex">
                      <Progress value={(referral.commissionMonthsLeft / commissionMonths) * 100} className="h-1.5 w-16" aria-label="Commission window left" />
                      <span className="text-[13px] text-muted-foreground">
                        {referral.commissionMonthsLeft > 0 ? `${referral.commissionMonthsLeft} mo left` : "Ended"}
                      </span>
                    </span>
                    <span role="cell" className="hidden tabular-nums sm:block">
                      {usd(referral.paidUsd)}
                    </span>
                    <span role="cell" className="text-right font-medium tabular-nums sm:text-left">
                      {usd(referral.earnedUsd)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">The people you referred couldn&apos;t be loaded.</p>
            <LoadingButton type="button" variant="outline" size="sm" loading={isFetching} onClick={() => refetch()}>
              Try again
            </LoadingButton>
          </div>
        ) : (
          <div className="space-y-3 px-5 py-4" aria-label="Loading the people you referred">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        )}
      </Card>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Referrals are shown by a short code, never by name or email.
        </p>
        {page && page.pagination.total > AFFILIATE_REFERRALS_PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">
              {page.pagination.offset + 1} to {page.pagination.offset + page.referrals.length} of {page.pagination.total}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous referrals"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex(pageIndex - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next referrals"
              disabled={page.pagination.offset + page.referrals.length >= page.pagination.total}
              onClick={() => setPageIndex(pageIndex + 1)}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </d.SettingsSection>
  );
}
