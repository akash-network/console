"use client";
import type { FC, ReactNode } from "react";
import { useMemo } from "react";
import { Button, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { CircleX, Clock } from "lucide-react";

import { failedPublishChecksOf, publishCheckLabelOf } from "@src/components/templates/publishing/publishReadiness";
import { useTemplateVersion } from "@src/queries/useUserTemplateQueries";
import type { TemplateVersionSummary } from "@src/types/marketplace-template";
import type { VersionDiffEntry } from "./describeVersionDiff";
import { describeVersionDiff } from "./describeVersionDiff";

export const DEPENDENCIES = {
  useTemplateVersion
};

type VersionChange = NonNullable<TemplateVersionSummary["changes"]>[number];

const CHANGE_LABELS: Record<VersionChange, string> = {
  first_version: "First version",
  service_added: "Service added",
  service_removed: "Service removed",
  image_changed: "Image changed",
  image_tag_changed: "Image tag changed",
  env_changed: "Env changed",
  ports_changed: "Ports changed",
  resources_changed: "Resources changed",
  asked_value_added: "Asked value added",
  asked_value_removed: "Asked value removed",
  asked_value_changed: "Asked value changed",
  readme_changed: "README changed"
};

const STATUSES: Record<TemplateVersionSummary["status"], { label: string; textClasses: string; dotClasses: string }> = {
  live: { label: "Published", textClasses: "text-green-700 dark:text-green-500", dotClasses: "bg-green-600" },
  held: { label: "Held for staff review", textClasses: "text-amber-700 dark:text-amber-500", dotClasses: "bg-amber-500" },
  failed_checks: { label: "Failed checks", textClasses: "text-red-600 dark:text-red-500", dotClasses: "bg-red-600" },
  rejected: { label: "Rejected by staff", textClasses: "text-red-600 dark:text-red-500", dotClasses: "bg-red-600" }
};

const MAX_LINES_PER_BLOCK = 50;

const EMPTY_CELL = "–";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const CHIP_CLASSES = "rounded-md border border-border px-1.5 py-0.5 text-xs font-medium";

export interface TemplateVersionsTabProps {
  templateId: string;
  versions: TemplateVersionSummary[];
  currentVersion: number | undefined;
  shownVersion: number | undefined;
  canEdit: boolean;
  onView: (version: number) => void;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplateVersionsTab: FC<TemplateVersionsTabProps> = ({
  templateId,
  versions,
  currentVersion,
  shownVersion,
  canEdit,
  onView,
  dependencies: d = DEPENDENCIES
}) => {
  const versionAwaitingReview = newestHeldVersionOf(versions, currentVersion);

  return (
    <div className={cn("grid items-start gap-5", canEdit && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
      <div className="flex min-w-0 flex-col gap-4">
        {versionAwaitingReview !== undefined && (
          <p
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">v{versionAwaitingReview} is waiting for Akash staff review.</span>{" "}
              {currentVersion === undefined ? "Nobody deploys it until then." : `v${currentVersion} stays the current version until then.`} You get an email and
              a notice in Console when it is decided.
            </span>
          </p>
        )}
        <div>
          <h2 className="text-base font-semibold">Version history</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Published versions never change. Deployments and forks stay on the version they started from.
          </p>
          <p className="text-[13px] text-muted-foreground">
            New versions come from Edit configuration → Save new version. On a public template, a new version goes live once its checks pass, and a risky change
            to a popular or Official template waits for staff review first.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead className="text-right">Deploys</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map(version => (
                <VersionRow
                  key={version.version}
                  version={version}
                  isCurrent={version.version === currentVersion}
                  isShown={version.version === shownVersion}
                  onView={() => onView(version.version)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {canEdit && shownVersion !== undefined && <WhatChangedPanel dependencies={d} templateId={templateId} version={shownVersion} />}
    </div>
  );
};

function newestHeldVersionOf(versions: TemplateVersionSummary[], currentVersion: number | undefined): number | undefined {
  const waiting = versions.filter(version => version.status === "held" && version.version > (currentVersion ?? 0)).map(version => version.version);
  return waiting.length > 0 ? Math.max(...waiting) : undefined;
}

const VersionRow: FC<{ version: TemplateVersionSummary; isCurrent: boolean; isShown: boolean; onView: () => void }> = ({
  version,
  isCurrent,
  isShown,
  onView
}) => {
  const status = STATUSES[version.status];
  const failureReasons = version.status === "failed_checks" ? failureReasonsOf(version) : [];
  const holdReasons = version.status === "held" ? (version.holdReasons ?? []).map(reason => reason.message) : [];
  const review = reviewOf(version);

  return (
    <TableRow aria-current={isShown || undefined}>
      <TableCell className="font-mono text-[13px] font-medium">v{version.version}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("flex items-center gap-1.5 text-[13px] font-medium", status.textClasses)}>
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dotClasses)} aria-hidden="true" />
            {status.label}
          </span>
          {isCurrent && <span className={CHIP_CLASSES}>Current</span>}
        </div>
        <ReasonList label={`Why v${version.version} failed`} reasons={failureReasons} icon={CircleX} className="text-red-600 dark:text-red-500" />
        <ReasonList label={`Why v${version.version} waits for review`} reasons={holdReasons} icon={Clock} className="text-amber-700 dark:text-amber-500" />
        {review && (
          <div className="mt-1.5 max-w-[320px] text-[12.5px]">
            <p className="text-muted-foreground">{review.outcome}</p>
            {review.note && (
              <p aria-label={`Staff note on v${version.version}`} className="mt-1 whitespace-pre-line break-words">
                {review.note}
              </p>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-[13px]">{version.createdBy?.username ?? EMPTY_CELL}</TableCell>
      <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">{format(new Date(version.createdAt), "MMM d, yyyy")}</TableCell>
      <TableCell>
        <ChangeChips changes={version.changes} />
      </TableCell>
      <TableCell className="text-right text-[13px]">{NUMBER_FORMAT.format(version.deploys)}</TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" aria-label={`View v${version.version}`} onClick={onView}>
          View
        </Button>
      </TableCell>
    </TableRow>
  );
};

const ReasonList: FC<{ label: string; reasons: string[]; icon: LucideIcon; className: string }> = ({ label, reasons, icon: Icon, className }) =>
  reasons.length > 0 ? (
    <ul aria-label={label} className="mt-1.5 flex max-w-[320px] flex-col gap-1">
      {reasons.map((reason, index) => (
        <li key={index} className={cn("flex items-start gap-1.5 break-words text-[12.5px]", className)}>
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{reason}</span>
        </li>
      ))}
    </ul>
  ) : null;

const REVIEW_OUTCOMES: Partial<Record<TemplateVersionSummary["status"], string>> = {
  live: "Approved by Akash staff",
  rejected: "Rejected by Akash staff"
};

/** Staff review only versions that were held, so a version nobody reviewed says nothing about one. */
function reviewOf(version: TemplateVersionSummary): { outcome: string; note: string | null } | undefined {
  const outcome = REVIEW_OUTCOMES[version.status];
  if (!outcome || (!version.reviewedAt && !version.reviewNote)) return undefined;

  return {
    outcome: version.reviewedAt ? `${outcome} on ${format(new Date(version.reviewedAt), "MMM d, yyyy")}` : outcome,
    note: version.reviewNote?.trim() || null
  };
}

function failureReasonsOf(version: TemplateVersionSummary): string[] {
  return failedPublishChecksOf(version.checkResults?.checks ?? []).flatMap(check =>
    check.issues.length > 0 ? check.issues.map(issue => issue.message) : [publishCheckLabelOf(check.key)]
  );
}

const ChangeChips: FC<{ changes: TemplateVersionSummary["changes"] }> = ({ changes }) => {
  if (changes === null) return <span className="text-muted-foreground">{EMPTY_CELL}</span>;
  if (changes.length === 0) return <span className="text-[13px] text-muted-foreground">No changes recorded</span>;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {changes.map(change => (
        <li key={change} className={CHIP_CLASSES}>
          {CHANGE_LABELS[change]}
        </li>
      ))}
    </ul>
  );
};

const WhatChangedPanel: FC<{ templateId: string; version: number; dependencies: typeof DEPENDENCIES }> = ({ templateId, version, dependencies: d }) => {
  const previousNumber = version > 1 ? version - 1 : undefined;
  const nextQuery = d.useTemplateVersion(templateId, version);
  const previousQuery = d.useTemplateVersion(templateId, previousNumber);
  const nextSdl = nextQuery.data?.sdl;
  const previousSdl = previousQuery.data?.sdl;
  const hasFailed = (nextSdl === undefined && !nextQuery.isLoading) || (previousNumber !== undefined && previousSdl === undefined && !previousQuery.isLoading);
  const diff = useMemo(
    () => (nextSdl !== undefined && (previousNumber === undefined || previousSdl !== undefined) ? describeVersionDiff(previousSdl, nextSdl) : undefined),
    [nextSdl, previousSdl, previousNumber]
  );

  return (
    <aside aria-label={`What changed in v${version}`} className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">What changed in v{version}</h3>
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{previousNumber === undefined ? `v${version}` : `v${previousNumber} → v${version}`}</p>
      <div className="mt-3">
        {hasFailed ? (
          <PanelNotice>Couldn&apos;t load what changed.</PanelNotice>
        ) : diff === undefined ? (
          <div role="status" aria-label={`Loading v${version}`} className="flex justify-center py-6">
            <Spinner size="small" />
          </div>
        ) : diff === null ? (
          <PanelNotice>Couldn&apos;t compare these versions.</PanelNotice>
        ) : diff.length === 0 ? (
          <PanelNotice>No image or env changes</PanelNotice>
        ) : (
          <div className="flex flex-col gap-3">
            {diff.map(entry => (
              <DiffBlock key={`${entry.service}-${entry.field}`} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

const DiffBlock: FC<{ entry: VersionDiffEntry }> = ({ entry }) => {
  const lines = [...entry.removed.map(line => ({ sign: "-" as const, line })), ...entry.added.map(line => ({ sign: "+" as const, line }))];
  const hiddenCount = lines.length - MAX_LINES_PER_BLOCK;

  return (
    <section aria-label={`${entry.service} ${entry.field}`}>
      <h4 className="font-mono text-xs text-muted-foreground">
        {entry.service} · {entry.field}
      </h4>
      <ul className="mt-1 overflow-hidden rounded-md border border-border font-mono text-xs">
        {lines.slice(0, MAX_LINES_PER_BLOCK).map(({ sign, line }) => (
          <DiffLine key={`${sign}${line}`} sign={sign} line={line} />
        ))}
        {hiddenCount > 0 && <li className="px-2 py-1 text-muted-foreground">+{hiddenCount} more</li>}
      </ul>
    </section>
  );
};

const DiffLine: FC<{ sign: "-" | "+"; line: string }> = ({ sign, line }) => (
  <li className={cn("flex gap-2 break-all px-2 py-1", sign === "-" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-foreground")}>
    <span>{sign}</span>
    <span>{line}</span>
  </li>
);

const PanelNotice: FC<{ children: ReactNode }> = ({ children }) => <p className="text-[13px] text-muted-foreground">{children}</p>;
