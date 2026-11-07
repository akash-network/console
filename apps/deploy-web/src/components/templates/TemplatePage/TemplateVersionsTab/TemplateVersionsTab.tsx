"use client";
import type { FC, ReactNode } from "react";
import { Button, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";

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

const STATUS_LABELS: Record<TemplateVersionSummary["status"], string> = {
  live: "Published",
  held: "Held for staff review",
  failed_checks: "Failed checks"
};

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
}) => (
  <div className={cn("grid items-start gap-5", canEdit && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Version history</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Published versions never change. Deployments and forks stay on the version they started from.</p>
        <p className="text-[13px] text-muted-foreground">New versions come from Edit configuration → Save new version.</p>
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

const VersionRow: FC<{ version: TemplateVersionSummary; isCurrent: boolean; isShown: boolean; onView: () => void }> = ({
  version,
  isCurrent,
  isShown,
  onView
}) => (
  <TableRow aria-current={isShown || undefined}>
    <TableCell className="font-mono text-[13px] font-medium">v{version.version}</TableCell>
    <TableCell>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px]">{STATUS_LABELS[version.status]}</span>
        {isCurrent && <span className={CHIP_CLASSES}>Current</span>}
      </div>
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

const ChangeChips: FC<{ changes: TemplateVersionSummary["changes"] }> = ({ changes }) => {
  if (changes === null) return <span className="text-muted-foreground">{EMPTY_CELL}</span>;
  if (changes.length === 0) return <span className="text-[13px] text-muted-foreground">No changes</span>;

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
  const next = nextQuery.data;
  const previous = previousQuery.data;
  const isLoading = nextQuery.isLoading || previousQuery.isLoading;
  const diff = next && (previousNumber === undefined || previous) ? describeVersionDiff(previous?.sdl, next.sdl) : undefined;

  return (
    <aside aria-label={`What changed in v${version}`} className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">What changed in v{version}</h3>
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{previousNumber === undefined ? `v${version}` : `v${previousNumber} → v${version}`}</p>
      <div className="mt-3">
        {isLoading ? (
          <div role="status" aria-label={`Loading v${version}`} className="flex justify-center py-6">
            <Spinner size="small" />
          </div>
        ) : !diff ? (
          <PanelNotice>Couldn&apos;t load what changed.</PanelNotice>
        ) : diff.length === 0 ? (
          <PanelNotice>No image or env changes.</PanelNotice>
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

const DiffBlock: FC<{ entry: VersionDiffEntry }> = ({ entry }) => (
  <section aria-label={`${entry.service} ${entry.field}`}>
    <h4 className="font-mono text-xs text-muted-foreground">
      {entry.service} · {entry.field}
    </h4>
    <ul className="mt-1 overflow-hidden rounded-md border border-border font-mono text-xs">
      {entry.removed.map(line => (
        <DiffLine key={`-${line}`} sign="-" line={line} />
      ))}
      {entry.added.map(line => (
        <DiffLine key={`+${line}`} sign="+" line={line} />
      ))}
    </ul>
  </section>
);

const DiffLine: FC<{ sign: "-" | "+"; line: string }> = ({ sign, line }) => (
  <li className={cn("flex gap-2 break-all px-2 py-1", sign === "-" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-foreground")}>
    <span>{sign}</span>
    <span>{line}</span>
  </li>
);

const PanelNotice: FC<{ children: ReactNode }> = ({ children }) => <p className="text-[13px] text-muted-foreground">{children}</p>;
