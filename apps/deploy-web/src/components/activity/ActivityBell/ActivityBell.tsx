"use client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner
} from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { activityEntriesOf, type ActivityEntry } from "@src/components/activity/activityEntries/activityEntries";
import { ActivityEntryContent } from "@src/components/activity/ActivityEntryContent/ActivityEntryContent";
import { deploymentLabelOf } from "@src/components/activity/activityLabels/activityLabels";
import { useServices } from "@src/context/ServicesProvider";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useFlag, useUser, useActivityFeedQuery, useDeploymentNames, useQueryClient };

const MAX_LISTED_ENTRIES = 10;

const MAX_COUNTED_UNSEEN = 9;

/** The newest of the user's actions in the top navigation: how many they haven't seen, and how each one went. */
export function ActivityBell({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const isEnabled = d.useFlag("notifications_activity_center");
  const { user } = d.useUser();
  const isShown = isEnabled && !!user?.userId;
  const { api } = useServices();
  const queryClient = d.useQueryClient();
  const { data: feed, isError } = d.useActivityFeedQuery({ enabled: isShown });
  const activities = feed?.activities ?? [];
  const unseenCount = feed?.unseenCount ?? 0;
  const { getDeploymentName } = d.useDeploymentNames(activities.map(activity => activity.meta.dseq));
  const markSeen = api.v1.markActivitiesSeen.useMutation({
    onSuccess: function refreshUnseenCount() {
      queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
    }
  });

  if (!isShown) return null;

  const entries = activityEntriesOf(activities, dseq => deploymentLabelOf(getDeploymentName(dseq), dseq), MAX_LISTED_ENTRIES);

  /** Marks up to the newest entry rather than up to now, so an action that lands while the list is open still counts as unseen. */
  function markListedSeen(isOpen: boolean) {
    const newest = activities[0];
    if (!isOpen || unseenCount === 0 || !newest) return;

    markSeen.mutate({ data: { upTo: newest.createdAt } });
  }

  return (
    <DropdownMenu modal={false} onOpenChange={markListedSeen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={unseenCount > 0 ? `Activity, ${unseenCount} unseen` : "Activity"}>
          <Bell className="h-5 w-5" />
          {unseenCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            >
              {unseenCount > MAX_COUNTED_UNSEEN ? `${MAX_COUNTED_UNSEEN}+` : unseenCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <DropdownMenuLabel className="px-4 py-3">Activity</DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <ActivityList entries={entries} isLoaded={!!feed} isError={isError} />
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="cursor-pointer justify-center rounded-none px-4 py-2.5 text-sm font-medium">
          <Link href={UrlService.activity()}>See all activity</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActivityList({ entries, isLoaded, isError }: { entries: ActivityEntry[]; isLoaded: boolean; isError: boolean }) {
  if (!isLoaded && isError) {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
        <TriangleAlert className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Couldn't load your activity</p>
        <p className="text-xs text-muted-foreground">Try again in a moment.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex justify-center px-6 py-10" role="status" aria-label="Loading activity">
        <Spinner size="small" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
        <Bell className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No activity yet</p>
        <p className="text-xs text-muted-foreground">When you close a deployment, you can follow how it goes here.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[min(28rem,70vh)] overflow-y-auto py-1">
      {entries.map(entry => (
        <ActivityEntryRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function ActivityEntryRow({ entry }: { entry: ActivityEntry }) {
  return (
    <DropdownMenuItem asChild className="cursor-pointer items-start gap-3 rounded-none px-4 py-2.5">
      <Link href={entry.href}>
        <ActivityEntryContent entry={entry} />
      </Link>
    </DropdownMenuItem>
  );
}
