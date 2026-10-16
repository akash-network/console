"use client";
import React, { type FC } from "react";
import { FormattedNumber } from "react-intl";
import { Badge, Card, Skeleton } from "@akashnetwork/ui/components";
import { ChevronRight } from "lucide-react";

import type { ProjectSpendRow } from "@src/components/billing-usage/UsageContainer/teamUsage";
import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { SectionLabel } from "@src/components/projects/SectionLabel/SectionLabel";

const LOADING_ROW_COUNT = 3;

const ROW_CLASS_NAME = "group flex w-full items-center gap-3.5 px-4 py-3.5 text-left";

const SELECTABLE_ROW_CLASS_NAME = `${ROW_CLASS_NAME} hover:bg-muted/60`;

export type ProjectSpendSection = {
  rows: ProjectSpendRow[];
  isEstimated: boolean;
  isPartial: boolean;
  isLoading: boolean;
  isError: boolean;
};

export type ProjectSpendListProps = ProjectSpendSection & { rangeLabel: string };

export const ProjectSpendList: FC<ProjectSpendListProps> = ({ rows, isEstimated, isPartial, isLoading, isError, rangeLabel }) => (
  <section aria-label="Spend by project">
    <SectionLabel rightSlot={<span className="text-xs text-muted-foreground">{rangeLabel}</span>}>Spend by project</SectionLabel>

    <Card className="overflow-hidden rounded-xl shadow-none">
      {isError ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Spend by project couldn&apos;t be loaded. Refresh the page to try again.</p>
      ) : isLoading ? (
        <div aria-busy className="divide-y divide-border">
          {Array.from({ length: LOADING_ROW_COUNT }, (_, index) => (
            <div key={index} className="px-4 py-3.5">
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No projects to show</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {rows.map(row => (
              <li key={row.key}>
                {row.onSelect ? (
                  <button
                    type="button"
                    onClick={row.onSelect}
                    title={`Show only ${row.label}`}
                    data-idle={row.consumedUsd === 0}
                    className={SELECTABLE_ROW_CLASS_NAME}
                  >
                    <ProjectSpendCells row={row} />
                    <ChevronRight aria-hidden className="h-[13px] w-[13px] shrink-0 text-muted-foreground" />
                  </button>
                ) : (
                  <div data-idle={row.consumedUsd === 0} className={ROW_CLASS_NAME}>
                    <ProjectSpendCells row={row} />
                    <span aria-hidden className="w-[13px] shrink-0" />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {(isEstimated || isPartial) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
              {isEstimated && (
                <span className="flex items-center gap-1.5">
                  <Badge variant="outline" className="px-1.5 py-0 text-[10.5px] font-medium">
                    Estimated
                  </Badge>
                  Includes lease costs the chain hasn&apos;t settled yet.
                </span>
              )}
              {isPartial && <span>Showing only the projects you can open.</span>}
            </div>
          )}
        </>
      )}
    </Card>
  </section>
);

const ProjectSpendCells: FC<{ row: ProjectSpendRow }> = ({ row }) => (
  <>
    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: row.shade ?? "hsl(var(--border))" }} />
    <span className="min-w-0 flex-1 sm:w-[180px] sm:flex-none">
      <span className="block truncate text-[13px] font-medium text-foreground group-data-[idle=true]:text-muted-foreground">{row.label}</span>
      <span className="block truncate font-mono text-[11px] text-muted-foreground">
        {row.consumedUsd > 0 ? <UsageSummary row={row} /> : "Nothing ran in this range"}
      </span>
    </span>
    <span aria-hidden className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:block">
      <span className="block h-full" style={{ width: `${row.sharePercent}%`, background: row.shade ?? "transparent" }} />
    </span>
    <span className="w-24 shrink-0 text-right font-mono tabular-nums">
      <span className="block text-[13px] font-medium text-foreground group-data-[idle=true]:text-muted-foreground">
        <UsdValue value={row.consumedUsd} />
      </span>
      {row.committedUsd > 0 && (
        <span className="block text-[11px] text-muted-foreground">
          <UsdValue value={row.committedUsd} /> committed
        </span>
      )}
    </span>
    <span className="w-[50px] shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
      <FormattedNumber value={row.sharePercent / 100} style="percent" minimumFractionDigits={1} maximumFractionDigits={1} />
    </span>
  </>
);

const UsageSummary: FC<{ row: ProjectSpendRow }> = ({ row }) => (
  <>
    <FormattedNumber value={row.deploymentCount} /> {row.deploymentCount === 1 ? "deployment" : "deployments"} ·{" "}
    <FormattedNumber value={row.hours} maximumFractionDigits={0} /> hrs
  </>
);
