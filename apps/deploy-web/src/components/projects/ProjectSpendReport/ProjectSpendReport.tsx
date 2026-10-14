"use client";
import type { ReactNode } from "react";
import { useState } from "react";
import { Badge, Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

import { useProjectSpendQuery } from "@src/queries/useProjectBudgetQueries";
import type { ProjectSpend, SpendAmounts } from "@src/types/project-budget";
import { UrlService } from "@src/utils/urlUtils";
import type { SpendRangePreset } from "../projectSpend";
import { formatSpendUsd, SPEND_RANGE_LABELS, SPEND_RANGE_PRESETS, spendRangeFor } from "../projectSpend";
import { SectionLabel } from "../SectionLabel/SectionLabel";

export const DEPENDENCIES = { useProjectSpendQuery };

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

const ROW_CLASS_NAME = "grid grid-cols-[minmax(0,1fr)_96px_96px] items-center gap-3 px-4 py-2.5 text-[13px]";

/** Spend per project over a range; the organization's total and the unassigned remainder show only to the roles the api gives them to. */
export function ProjectSpendReport({ dependencies: d = DEPENDENCIES }: Props) {
  const [preset, setPreset] = useState<SpendRangePreset>("this-month");
  const spendQuery = d.useProjectSpendQuery(spendRangeFor(preset));
  const report = spendQuery.data;

  return (
    <section aria-label="Spend by project" className="mt-8">
      <SectionLabel rightSlot={<RangePicker selected={preset} onSelect={setPreset} />}>Spend by project</SectionLabel>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {spendQuery.isError ? (
          <div className="flex flex-col items-center gap-3 px-4 py-6">
            <p className="text-[12.5px] text-muted-foreground">Couldn&apos;t load spend.</p>
            <Button variant="outline" size="sm" onClick={() => spendQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : !report ? (
          <p className="px-4 py-5 text-center text-[12.5px] text-muted-foreground">Loading spend…</p>
        ) : (
          <>
            <div role="table" aria-label="Spend per project">
              <div role="rowgroup">
                <div
                  role="row"
                  className={cn(ROW_CLASS_NAME, "border-b border-border py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground")}
                >
                  <span role="columnheader">Project</span>
                  <span role="columnheader" className="text-right">
                    Committed
                  </span>
                  <span role="columnheader" className="text-right">
                    Consumed
                  </span>
                </div>
              </div>

              <div role="rowgroup" className="divide-y divide-border">
                {report.projects.map(project => (
                  <ProjectSpendRow key={project.projectId} project={project} />
                ))}
                {report.unassigned && <SpendRow label={<span className="text-muted-foreground">Unassigned</span>} amounts={report.unassigned} />}
                {report.total && <SpendRow label={<span className="font-semibold">Total</span>} amounts={report.total} className="bg-muted/40 font-semibold" />}
              </div>
            </div>

            {report.projects.length === 0 && <p className="px-4 py-5 text-center text-[12.5px] text-muted-foreground">No projects to show.</p>}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
              {report.isEstimated && (
                <span className="flex items-center gap-1.5">
                  <Badge variant="outline" className="px-1.5 py-0 text-[10.5px] font-medium">
                    Estimated
                  </Badge>
                  Consumed includes lease costs the chain hasn&apos;t settled yet.
                </span>
              )}
              {!report.total && <span>Showing only the projects you can open.</span>}
              <span>
                {report.startDate} to {report.endDate}, UTC
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function RangePicker({ selected, onSelect }: { selected: SpendRangePreset; onSelect: (preset: SpendRangePreset) => void }) {
  return (
    <div role="group" aria-label="Date range" className="flex flex-wrap justify-end gap-1">
      {SPEND_RANGE_PRESETS.map(preset => (
        <Button
          key={preset}
          type="button"
          size="sm"
          variant={preset === selected ? "secondary" : "ghost"}
          aria-pressed={preset === selected}
          className="h-7 px-2.5 text-xs"
          onClick={() => onSelect(preset)}
        >
          {SPEND_RANGE_LABELS[preset]}
        </Button>
      ))}
    </div>
  );
}

function ProjectSpendRow({ project }: { project: ProjectSpend }) {
  const label = project.isDeleted ? (
    <span className="truncate text-muted-foreground">{project.name} (deleted)</span>
  ) : (
    <Link href={UrlService.project(project.projectId)} className="truncate font-medium hover:underline">
      {project.name}
    </Link>
  );

  return <SpendRow label={label} amounts={project} />;
}

function SpendRow({ label, amounts, className }: { label: ReactNode; amounts: SpendAmounts; className?: string }) {
  return (
    <div role="row" className={cn(ROW_CLASS_NAME, className)}>
      <span role="rowheader" className="flex min-w-0">
        {label}
      </span>
      <span role="cell" className="text-right font-mono">
        {formatSpendUsd(amounts.committedUsd)}
      </span>
      <span role="cell" className="text-right font-mono">
        {formatSpendUsd(amounts.consumedUsd)}
      </span>
    </div>
  );
}
