import { Spinner } from "@akashnetwork/ui/components";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";

import type { ActivityEntry } from "@src/components/activity/activityEntries/activityEntries";

/** One entry as the bell and the history page both show it: how it went, what happened and when. */
export function ActivityEntryContent({ entry }: { entry: ActivityEntry }) {
  return (
    <>
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <ActivityStatusIcon status={entry.status} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="break-words text-sm font-medium leading-5">{entry.title}</span>
        {entry.detail && <span className="break-words text-xs text-muted-foreground">{entry.detail}</span>}
        <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(entry.createdAt), { addSuffix: true })}</span>
      </span>
    </>
  );
}

function ActivityStatusIcon({ status }: { status: ActivityEntry["status"] }) {
  if (status === "pending") return <Spinner size="small" />;
  if (status === "succeeded") return <CircleCheck className="h-4 w-4 text-green-600" />;
  if (status === "partial") return <TriangleAlert className="h-4 w-4 text-warning" />;

  return <CircleX className="h-4 w-4 text-destructive" />;
}
