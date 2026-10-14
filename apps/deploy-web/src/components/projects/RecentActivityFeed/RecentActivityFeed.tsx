"use client";
import type { ComponentType } from "react";
import { Avatar, AvatarFallback, Button } from "@akashnetwork/ui/components";
import { Activity, Clock, Wallet } from "lucide-react";
import Link from "next/link";

import type { OrganizationActivity, OrganizationActivityActor } from "@src/types/organization-activity";
import type { Project } from "@src/types/project";
import { initialsOf } from "@src/utils/initials";
import { formatRelativeTime } from "@src/utils/relativeTime";
import { UrlService } from "@src/utils/urlUtils";
import { SectionLabel } from "../SectionLabel/SectionLabel";
import type { ActivitySegment, ActivitySystemIcon } from "./activityText";
import { describeActivity } from "./activityText";

const SYSTEM_ICONS: Record<ActivitySystemIcon, ComponentType<{ className?: string }>> = { clock: Clock, wallet: Wallet, activity: Activity };

interface Props {
  activities: OrganizationActivity[];
  /** The projects the items may belong to, so an item can name and link its project. */
  projects: Pick<Project, "id" | "name">[];
  hasMore: boolean;
  onShowMore: () => void;
  isError?: boolean;
  onRetry?: () => void;
  /** Off on a project's own page, where every item is of that project. */
  showsProjects?: boolean;
}

/** What happened lately in the organization, newest first, with the member or system behind each event. */
export function RecentActivityFeed({ activities, projects, hasMore, onShowMore, isError = false, onRetry, showsProjects = true }: Props) {
  const projectNameById = new Map(projects.map(project => [project.id, project.name]));

  return (
    <section aria-label="Recent activity">
      <SectionLabel>Recent activity</SectionLabel>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {isError && activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            <p>Couldn&apos;t load the activity.</p>
            {onRetry && (
              <Button variant="outline" size="xs" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : activities.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="divide-y divide-border">
            {activities.map(activity => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                projectName={showsProjects && activity.projectId ? projectNameById.get(activity.projectId) : undefined}
              />
            ))}
          </ol>
        )}

        {hasMore && (
          <button
            type="button"
            className="block w-full border-t border-border px-4 py-[11px] text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
            onClick={onShowMore}
          >
            Show more
          </button>
        )}
      </div>
    </section>
  );
}

function ActivityItem({ activity, projectName }: { activity: OrganizationActivity; projectName: string | undefined }) {
  const { segments, systemIcon } = describeActivity(activity);
  const SystemIcon = SYSTEM_ICONS[systemIcon];

  return (
    <li className="flex gap-3 px-4 py-3.5">
      {activity.actor ? (
        <ActorAvatar actor={activity.actor} />
      ) : (
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-border bg-muted">
          <SystemIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <p className="break-words text-[13px] leading-[19px] text-muted-foreground">
          {activity.actor && <strong className="font-semibold text-foreground">{activity.actor.username ?? "A member"}</strong>}
          {segments.map((segment, index) => (
            <span key={index}>
              {activity.actor || index > 0 ? " " : null}
              <Segment segment={segment} />
            </span>
          ))}
        </p>

        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{formatRelativeTime(activity.createdAt)}</span>
          {activity.projectId && projectName && (
            <>
              <span aria-hidden="true">·</span>
              <Link href={UrlService.project(activity.projectId)} className="hover:text-foreground hover:underline hover:underline-offset-[3px]">
                {projectName}
              </Link>
            </>
          )}
        </span>
      </div>
    </li>
  );
}

function Segment({ segment }: { segment: ActivitySegment }) {
  if (segment.kind === "deployment") {
    return (
      <Link href={UrlService.deploymentDetails(segment.dseq)} className="font-semibold text-foreground hover:underline hover:underline-offset-[3px]">
        {segment.text}
      </Link>
    );
  }
  if (segment.kind === "strong") return <strong className="font-semibold text-foreground">{segment.text}</strong>;
  return <>{segment.text}</>;
}

function ActorAvatar({ actor }: { actor: OrganizationActivityActor }) {
  return (
    <Avatar className="h-[30px] w-[30px]">
      <AvatarFallback className="text-[11px] font-semibold">{initialsOf(actor.username ?? "?")}</AvatarFallback>
    </Avatar>
  );
}
