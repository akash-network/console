"use client";
import { Avatar, AvatarFallback, Skeleton } from "@akashnetwork/ui/components";

import { useProjectMembersQuery } from "@src/queries/useProjectMembersQuery";
import type { ProjectRole } from "@src/types/project";
import { initialsOf } from "@src/utils/initials";
import { pluralize } from "@src/utils/stringUtils";
import { SectionLabel } from "../SectionLabel/SectionLabel";

export const DEPENDENCIES = { useProjectMembersQuery };

export const MAX_PREVIEWED_MEMBERS = 5;

const ROLE_LABELS: Record<ProjectRole, string> = { admin: "Admin", member: "Member", viewer: "Viewer" };

interface Props {
  projectId: string;
  dependencies?: typeof DEPENDENCIES;
}

/** Who was granted the project, a few at a time; owners and admins reach it without a grant, so they are named only in the footnote. */
export function ProjectMembersPreview({ projectId, dependencies: d = DEPENDENCIES }: Props) {
  const { data: members = [], isLoading, isError } = d.useProjectMembersQuery(projectId);
  const previewedMembers = members.slice(0, MAX_PREVIEWED_MEMBERS);
  const hiddenCount = members.length - previewedMembers.length;

  return (
    <section aria-label="Members">
      <SectionLabel rightSlot={!isLoading && <span className="whitespace-nowrap text-xs text-muted-foreground">{pluralize(members.length, "member")}</span>}>
        Members
      </SectionLabel>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {isLoading ? (
          <MembersPreviewSkeleton />
        ) : isError ? (
          <p className="px-4 py-5 text-center text-[12.5px] text-muted-foreground">Couldn&apos;t load the members.</p>
        ) : members.length === 0 ? (
          <p className="px-4 py-5 text-center text-[12.5px] text-muted-foreground">No one has been granted this project yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {previewedMembers.map(member => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[11px] font-semibold">{initialsOf(member.username || member.email || "?")}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{member.username || member.email || "A member"}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
              </li>
            ))}
          </ul>
        )}

        {hiddenCount > 0 && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">and {hiddenCount} more</p>}

        <p className="border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">Owners and admins can open every project.</p>
      </div>
    </section>
  );
}

const MembersPreviewSkeleton = () => (
  <div role="status" aria-label="Loading the members" className="flex flex-col gap-3 px-4 py-3">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3.5 w-32" />
      </div>
    ))}
  </div>
);
