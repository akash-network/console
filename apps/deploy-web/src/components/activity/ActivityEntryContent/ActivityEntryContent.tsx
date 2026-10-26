import type { ComponentType } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";
import { Activity, BellRing, CircleX, Clock, TriangleAlert, Wallet } from "lucide-react";

import { MemberAvatar, SystemAvatar } from "@src/components/activity/ActivityAvatar/ActivityAvatar";
import type { ActivityEntry, ActivityEntrySystemIcon } from "@src/components/activity/activityEntries/activityEntries";

const SYSTEM_ICONS: Record<ActivityEntrySystemIcon, ComponentType<{ className?: string }>> = {
  clock: Clock,
  wallet: Wallet,
  bell: BellRing,
  activity: Activity
};

/** One entry as the bell and the history page both show it: who caused it and how it went, what happened and when. */
export function ActivityEntryContent({ entry, actorName }: { entry: ActivityEntry; actorName: string | undefined }) {
  return (
    <>
      <span className="relative flex h-[30px] w-[30px] shrink-0">
        {entry.systemIcon ? <SystemAvatar icon={SYSTEM_ICONS[entry.systemIcon]} /> : <MemberAvatar name={actorName} />}
        <ActivityStatusBadge status={entry.status} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="break-words text-sm font-medium leading-5">{entry.title}</span>
        {entry.detail && <span className="break-words text-xs text-muted-foreground">{entry.detail}</span>}
        {entry.changeSummary && <span className="break-words text-[11px] leading-4 text-muted-foreground/80">{entry.changeSummary}</span>}
        <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(entry.createdAt), { addSuffix: true })}</span>
      </span>
    </>
  );
}

function ActivityStatusBadge({ status }: { status: ActivityEntry["status"] }) {
  const icon = statusIconOf(status);
  if (!icon) return null;

  return <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-card ring-1 ring-border">{icon}</span>;
}

function statusIconOf(status: ActivityEntry["status"]) {
  if (status === "pending") return <Spinner size="small" className="[&_svg]:h-3 [&_svg]:w-3" />;
  if (status === "failed") return <CircleX className="h-3 w-3 text-destructive" />;
  if (status === "partial") return <TriangleAlert className="h-2.5 w-2.5 text-warning" />;

  return null;
}
