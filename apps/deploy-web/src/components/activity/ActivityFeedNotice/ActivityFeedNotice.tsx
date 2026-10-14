"use client";
import type { ReactNode } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { Bell, TriangleAlert } from "lucide-react";

export type ActivityFeedStatus = "unavailable" | "loading" | "empty" | "listed";

/** A failed refresh keeps showing the entries already loaded, so only a feed that never answered reads as unavailable. */
export function activityFeedStatusOf({ isLoaded, isError, entryCount }: { isLoaded: boolean; isError: boolean; entryCount: number }): ActivityFeedStatus {
  if (!isLoaded) return isError ? "unavailable" : "loading";

  return entryCount === 0 ? "empty" : "listed";
}

export function ActivityFeedNotice({ status }: { status: Exclude<ActivityFeedStatus, "listed"> }) {
  if (status === "loading") {
    return (
      <div className="flex justify-center px-6 py-10" role="status" aria-label="Loading activity">
        <Spinner size="small" />
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <Notice icon={<TriangleAlert className="h-6 w-6 text-muted-foreground" />} title="Couldn't load your activity">
        Try again in a moment.
      </Notice>
    );
  }

  return (
    <Notice icon={<Bell className="h-6 w-6 text-muted-foreground" />} title="No activity yet">
      When you close a deployment, you can follow how it goes here.
    </Notice>
  );
}

function Notice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
      <span className="mb-2">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}
