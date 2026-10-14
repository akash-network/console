"use client";
import { useId } from "react";
import { Card } from "@akashnetwork/ui/components";
import Link from "next/link";

import { activityEntriesOf, type ActivityEntry } from "@src/components/activity/activityEntries/activityEntries";
import { ActivityEntryContent } from "@src/components/activity/ActivityEntryContent/ActivityEntryContent";
import { ActivityFeedNotice, activityFeedStatusOf } from "@src/components/activity/ActivityFeedNotice/ActivityFeedNotice";
import { deploymentLabelOf } from "@src/components/activity/activityLabels/activityLabels";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useFlag, useUser, useActivityFeedQuery, useDeploymentNames };

const MAX_LISTED_ENTRIES = 8;

/** The user's newest actions beside their deployments, settling as the activity host polls the feed. */
export function RecentActivity({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const headingId = useId();
  const isEnabled = d.useFlag("notifications_activity_center");
  const { user } = d.useUser();
  const isShown = isEnabled && !!user?.userId;
  const { data: feed, isError } = d.useActivityFeedQuery({ enabled: isShown });
  const activities = feed?.activities ?? [];
  const { getDeploymentName } = d.useDeploymentNames(activities.map(activity => activity.meta.dseq));

  if (!isShown) return null;

  const entries = activityEntriesOf(activities, dseq => deploymentLabelOf(getDeploymentName(dseq), dseq), MAX_LISTED_ENTRIES);

  return (
    <aside aria-labelledby={headingId} className="min-w-0">
      <Card className="overflow-hidden">
        <h2 id={headingId} className="border-b px-4 py-3 text-sm font-semibold">
          Recent activity
        </h2>
        <RecentActivityList entries={entries} isLoaded={!!feed} isError={isError} />
        {entries.length > 0 && (
          <Link href={UrlService.activity()} className="block border-t px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted/50">
            Show more
          </Link>
        )}
      </Card>
    </aside>
  );
}

function RecentActivityList({ entries, isLoaded, isError }: { entries: ActivityEntry[]; isLoaded: boolean; isError: boolean }) {
  const status = activityFeedStatusOf({ isLoaded, isError, entryCount: entries.length });

  if (status !== "listed") return <ActivityFeedNotice status={status} />;

  return (
    <ul className="divide-y divide-border">
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
