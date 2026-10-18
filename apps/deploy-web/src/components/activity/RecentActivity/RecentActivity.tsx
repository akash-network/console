"use client";
import Link from "next/link";

import { activityEntriesOf, type ActivityEntry } from "@src/components/activity/activityEntries/activityEntries";
import { ActivityEntryContent } from "@src/components/activity/ActivityEntryContent/ActivityEntryContent";
import { ActivityFeedNotice, activityFeedStatusOf } from "@src/components/activity/ActivityFeedNotice/ActivityFeedNotice";
import { deploymentLabelOf } from "@src/components/activity/activityLabels/activityLabels";
import { SectionLabel } from "@src/components/projects/SectionLabel/SectionLabel";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useFlag, useUser, useActivityFeedQuery, useDeploymentNames };

const MAX_LISTED_ENTRIES = 8;

/** The user's newest actions beside their deployments, settling as the activity host polls the feed. */
export function RecentActivity({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const isEnabled = d.useFlag("notifications_activity_center");
  const { user } = d.useUser();
  const isShown = isEnabled && !!user?.userId;
  const { data: feed, isError } = d.useActivityFeedQuery({ enabled: isShown });
  const activities = feed?.activities ?? [];
  const { getDeploymentName } = d.useDeploymentNames(activities.map(activity => activity.meta.dseq));

  if (!isShown) return null;

  const entries = activityEntriesOf(activities, dseq => deploymentLabelOf(getDeploymentName(dseq), dseq), MAX_LISTED_ENTRIES);

  return (
    <section aria-label="Recent activity">
      <SectionLabel>Recent activity</SectionLabel>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <RecentActivityList entries={entries} isLoaded={!!feed} isError={isError} />
        {entries.length > 0 && (
          <Link
            href={UrlService.activity()}
            className="block border-t border-border px-4 py-[11px] text-center text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Show more
          </Link>
        )}
      </div>
    </section>
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
