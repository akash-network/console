"use client";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";

import { activityEntriesOf, type ActivityEntry } from "@src/components/activity/activityEntries/activityEntries";
import { ActivityEntryContent } from "@src/components/activity/ActivityEntryContent/ActivityEntryContent";
import { ActivityFeedNotice, type ActivityFeedStatus, activityFeedStatusOf } from "@src/components/activity/ActivityFeedNotice/ActivityFeedNotice";
import { deploymentLabelOf } from "@src/components/activity/activityLabels/activityLabels";
import { ReceivedInvitationList } from "@src/components/organizations/ReceivedInvitationList/ReceivedInvitationList";
import { useServices } from "@src/context/ServicesProvider";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useReceivedInvitationsQuery } from "@src/queries/useInvitationQueries";
import { useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useUser, useFlag, useActivityFeedQuery, useReceivedInvitationsQuery, useDeploymentNames, useQueryClient, ReceivedInvitationList };

const MAX_LISTED_ENTRIES = 10;

const MAX_COUNTED_UNSEEN = 9;

/** The newest of the user's actions in the top navigation: how many they haven't seen, and how each one went. */
export function ActivityBell({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const { user } = d.useUser();
  const isShown = !!user?.userId;
  const { api } = useServices();
  const queryClient = d.useQueryClient();
  const { data: feed, isError } = d.useActivityFeedQuery({ enabled: isShown });
  const isOrganizationsEnabled = d.useFlag("organizations");
  const { data: invitations = [] } = d.useReceivedInvitationsQuery({ enabled: isShown && isOrganizationsEnabled });
  const activities = feed?.activities ?? [];
  const unseenCount = feed?.unseenCount ?? 0;
  const attentionCount = unseenCount + invitations.length;
  const { getDeploymentName } = d.useDeploymentNames(activities.map(activity => activity.meta.dseq));
  const markSeen = api.v1.markActivitiesSeen.useMutation({
    onSuccess: function refreshUnseenCount() {
      queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [unseenWhenOpened, setUnseenWhenOpened] = useState<ReadonlySet<string>>(new Set());

  if (!isShown) return null;

  const entries = activityEntriesOf(activities, dseq => deploymentLabelOf(getDeploymentName(dseq), dseq), MAX_LISTED_ENTRIES);
  const feedStatus = activityFeedStatusOf({ isLoaded: !!feed, isError, entryCount: entries.length });
  const isFeedShown = feedStatus !== "empty" || invitations.length === 0;

  /** Marking seen refreshes the feed while the list is still open, so the highlight is a snapshot taken in the very render that opens it. */
  function toggleActivityList(isOpening: boolean) {
    setIsOpen(isOpening);
    if (!isOpening) return;

    setUnseenWhenOpened(new Set(entries.filter(entry => entry.isUnseen).map(entry => entry.id)));
    markListedSeen();
  }

  /** Marks up to the newest entry rather than up to now, so an action that lands while the list is open still counts as unseen. */
  function markListedSeen() {
    const upTo = feed?.newestCreatedAt;
    if (unseenCount === 0 || !upTo) return;

    markSeen.mutate({ data: { upTo } });
  }

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={toggleActivityList}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border bg-background text-muted-foreground transition-colors data-[state=open]:bg-muted data-[state=open]:text-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={describeBell({ unseenCount, invitationCount: invitations.length })}
        >
          <Bell className="h-4 w-4" />
          {attentionCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            >
              {attentionCount > MAX_COUNTED_UNSEEN ? `${MAX_COUNTED_UNSEEN}+` : attentionCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <DropdownMenuLabel className="px-4 py-3">Activity</DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        {invitations.length > 0 && (
          <>
            <d.ReceivedInvitationList invitations={invitations} />
            {isFeedShown && <DropdownMenuSeparator className="m-0" />}
          </>
        )}
        {isFeedShown && <ActivityList entries={entries} actorName={user?.username} unseenWhenOpened={unseenWhenOpened} status={feedStatus} />}
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="cursor-pointer justify-center rounded-none px-4 py-2.5 text-sm font-medium">
          <Link href={UrlService.activity()}>See all activity</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function describeBell({ unseenCount, invitationCount }: { unseenCount: number; invitationCount: number }): string {
  const counts = [
    invitationCount > 0 && `${invitationCount} ${invitationCount === 1 ? "invitation" : "invitations"}`,
    unseenCount > 0 && `${unseenCount} unseen`
  ].filter(Boolean);

  return ["Activity", ...counts].join(", ");
}

function ActivityList({
  entries,
  actorName,
  unseenWhenOpened,
  status
}: {
  entries: ActivityEntry[];
  actorName: string | undefined;
  unseenWhenOpened: ReadonlySet<string>;
  status: ActivityFeedStatus;
}) {
  if (status !== "listed") return <ActivityFeedNotice status={status} />;

  return (
    <div className="max-h-[min(28rem,70vh)] overflow-y-auto py-1">
      {entries.map(entry => (
        <ActivityEntryRow key={entry.id} entry={entry} actorName={actorName} isUnseen={entry.isUnseen || unseenWhenOpened.has(entry.id)} />
      ))}
    </div>
  );
}

function ActivityEntryRow({ entry, actorName, isUnseen }: { entry: ActivityEntry; actorName: string | undefined; isUnseen: boolean }) {
  return (
    <DropdownMenuItem
      asChild
      className="cursor-pointer items-start gap-3 rounded-none px-4 py-2.5 has-[[data-unseen]]:bg-accent/50 has-[[data-unseen]]:focus:bg-accent"
    >
      <Link href={entry.href}>
        <ActivityEntryContent entry={entry} actorName={actorName} />
        {isUnseen && <UnseenMarker />}
      </Link>
    </DropdownMenuItem>
  );
}

function UnseenMarker() {
  return (
    <span data-unseen className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary">
      <span className="sr-only">Unseen</span>
    </span>
  );
}
