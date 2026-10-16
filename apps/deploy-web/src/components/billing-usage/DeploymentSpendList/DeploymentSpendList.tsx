"use client";
import React, { type FC } from "react";
import { FormattedNumber } from "react-intl";
import { Card, Skeleton } from "@akashnetwork/ui/components";
import Link from "next/link";

import { spendShade } from "@src/components/billing-usage/spendShade";
import type { DeploymentSpendRow } from "@src/components/billing-usage/UsageContainer/teamUsage";
import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { SectionLabel } from "@src/components/projects/SectionLabel/SectionLabel";
import { UrlService } from "@src/utils/urlUtils";

const LOADING_ROW_COUNT = 3;

export type DeploymentSpendSection = {
  title: string;
  rows: DeploymentSpendRow[];
  showsProject: boolean;
  isLoading: boolean;
  isError: boolean;
};

export type DeploymentSpendListProps = DeploymentSpendSection & { rangeLabel: string };

export const DeploymentSpendList: FC<DeploymentSpendListProps> = ({ title, rows, showsProject, isLoading, isError, rangeLabel }) => (
  <section aria-label={title}>
    <SectionLabel rightSlot={<span className="text-xs text-muted-foreground">{rangeLabel}</span>}>{title}</SectionLabel>

    <Card className="overflow-hidden rounded-xl shadow-none">
      {isError ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Spend by deployment couldn&apos;t be loaded. Refresh the page to try again.</p>
      ) : isLoading ? (
        <div aria-busy className="divide-y divide-border">
          {Array.from({ length: LOADING_ROW_COUNT }, (_, index) => (
            <div key={index} className="px-4 py-3.5">
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No spend in this range</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row, index) => (
            <DeploymentSpendItem key={row.dseq} row={row} shade={spendShade(index, rows.length)} showsProject={showsProject} />
          ))}
        </ul>
      )}
    </Card>
  </section>
);

const DeploymentSpendItem: FC<{ row: DeploymentSpendRow; shade: string; showsProject: boolean }> = ({ row, shade, showsProject }) => (
  <li className="flex items-center gap-3.5 px-4 py-3.5">
    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: shade }} />
    <div className="min-w-0 flex-1 sm:w-[180px] sm:flex-none">
      <Link href={UrlService.deploymentDetails(row.dseq)} className="block truncate text-[13px] font-medium hover:underline">
        {row.name ?? `DSEQ ${row.dseq}`}
      </Link>
      <span className="block truncate font-mono text-[11px] text-muted-foreground">
        {showsProject && `${row.projectName} · `}
        <FormattedNumber value={row.hours} maximumFractionDigits={0} /> hrs · <UsdValue value={row.hourlyRateUsd} />
        /hr
      </span>
    </div>
    <div aria-hidden className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:block">
      <div className="h-full" style={{ width: `${row.sharePercent}%`, background: shade }} />
    </div>
    <span className="w-24 shrink-0 text-right font-mono text-[13px] font-medium tabular-nums">
      <UsdValue value={row.consumedUsd} />
    </span>
    <span className="w-[50px] shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
      <FormattedNumber value={row.sharePercent / 100} style="percent" minimumFractionDigits={1} maximumFractionDigits={1} />
    </span>
  </li>
);
