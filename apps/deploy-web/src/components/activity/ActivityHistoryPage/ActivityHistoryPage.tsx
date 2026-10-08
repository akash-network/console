"use client";
import { useState } from "react";
import {
  Button,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner
} from "@akashnetwork/ui/components";
import { Bell, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { type ActivityEntry, activityEntryOf } from "@src/components/activity/activityEntries/activityEntries";
import { ActivityEntryContent } from "@src/components/activity/ActivityEntryContent/ActivityEntryContent";
import { deploymentLabelOf } from "@src/components/activity/activityLabels/activityLabels";
import Layout from "@src/components/layout/Layout";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useActivityHistoryQuery } from "@src/queries/useActivityHistoryQuery";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";

export const DEPENDENCIES = { Layout, useActivityHistoryQuery, useDeploymentNames };

const ANY = "any";

const STATUS_LABELS = { pending: "In progress", succeeded: "Succeeded", failed: "Failed" } satisfies Record<Activity["status"], string>;

const ACTION_LABELS = { deployment_close: "Deployment closes" } satisfies Record<Activity["type"], string>;

const FILTER_TRIGGER_CLASS_NAME = "h-9 min-w-0 flex-1 gap-2 text-[13px] font-medium sm:w-auto sm:min-w-[9.5rem] sm:flex-none";

/** Everything in the user's activity feed, newest first, filtered by status and action and paged back by the api's cursor. */
export function ActivityHistoryPage({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const [status, setStatus] = useState<Activity["status"]>();
  const [type, setType] = useState<Activity["type"]>();
  const [olderPageCursors, setOlderPageCursors] = useState<string[]>([]);
  const cursor = olderPageCursors.at(-1);
  const { data, isError, refetch } = d.useActivityHistoryQuery({ status, type, cursor });
  const activities = data?.activities ?? [];
  const nextCursor = data?.nextCursor ?? null;
  const { getDeploymentName } = d.useDeploymentNames(activities.map(activity => activity.meta.dseq));
  const entries = activities.map(activity => activityEntryOf(activity, dseq => deploymentLabelOf(getDeploymentName(dseq), dseq)));
  const hasNewerPage = olderPageCursors.length > 0;

  function filterByStatus(value: string) {
    setStatus(value === ANY ? undefined : (value as Activity["status"]));
    setOlderPageCursors([]);
  }

  function filterByAction(value: string) {
    setType(value === ANY ? undefined : (value as Activity["type"]));
    setOlderPageCursors([]);
  }

  function showOlderPage() {
    if (nextCursor) setOlderPageCursors([...olderPageCursors, nextCursor]);
  }

  function showNewerPage() {
    setOlderPageCursors(olderPageCursors.slice(0, -1));
  }

  return (
    <d.Layout disableContainer>
      <NextSeo title="Activity" />

      <div className="flex flex-col md:h-page-viewport">
        <div className="flex min-h-[60px] shrink-0 items-center border-b border-border bg-background py-2">
          <div className="container flex flex-wrap items-center gap-3 px-4 sm:px-6">
            <h1 className="mr-auto whitespace-nowrap text-xl font-bold leading-7 tracking-[-0.02em]">Activity</h1>

            <div className="flex w-full gap-3 sm:w-auto">
              <Select value={status ?? ANY} onValueChange={filterByStatus}>
                <SelectTrigger aria-label="Status" className={FILTER_TRIGGER_CLASS_NAME}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={type ?? ANY} onValueChange={filterByAction}>
                <SelectTrigger aria-label="Action" className={FILTER_TRIGGER_CLASS_NAME}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All actions</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
          <div className="container p-4 pb-8 sm:p-6">
            <ActivityHistoryList
              entries={entries}
              isLoaded={!!data}
              isError={isError}
              isFiltered={status !== undefined || type !== undefined}
              onRetry={() => refetch()}
            />

            {(hasNewerPage || nextCursor) && (
              <Pagination className="pt-6">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={showNewerPage} disabled={!hasNewerPage} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext onClick={showOlderPage} disabled={!nextCursor} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>
      </div>
    </d.Layout>
  );
}

function ActivityHistoryList({
  entries,
  isLoaded,
  isError,
  isFiltered,
  onRetry
}: {
  entries: ActivityEntry[];
  isLoaded: boolean;
  isError: boolean;
  isFiltered: boolean;
  onRetry: () => void;
}) {
  if (!isLoaded && isError) {
    return (
      <ActivityHistoryNotice icon={<TriangleAlert className="h-6 w-6 text-muted-foreground" />} title="Couldn't load your activity">
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </ActivityHistoryNotice>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading activity">
        <Spinner size="small" />
      </div>
    );
  }

  if (entries.length === 0) {
    return isFiltered ? (
      <ActivityHistoryNotice icon={<Bell className="h-6 w-6 text-muted-foreground" />} title="No activity matches these filters">
        <p className="text-sm text-muted-foreground">Try another status or action.</p>
      </ActivityHistoryNotice>
    ) : (
      <ActivityHistoryNotice icon={<Bell className="h-6 w-6 text-muted-foreground" />} title="No activity yet">
        <p className="text-sm text-muted-foreground">When you close a deployment, you can follow how it goes here.</p>
      </ActivityHistoryNotice>
    );
  }

  return (
    <ul aria-label="Activity" className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {entries.map(entry => (
        <li key={entry.id}>
          <Link href={entry.href} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
            <ActivityEntryContent entry={entry} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ActivityHistoryNotice({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 py-16 text-center">
      <span className="mb-2">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}
