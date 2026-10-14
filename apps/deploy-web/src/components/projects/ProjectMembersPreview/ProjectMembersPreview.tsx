"use client";
import { useState } from "react";
import { Avatar, AvatarFallback, Button, Skeleton } from "@akashnetwork/ui/components";
import { UserCog } from "lucide-react";

import { useProjectAccess } from "@src/hooks/useProjectAccess/useProjectAccess";
import { useUser } from "@src/hooks/useUser";
import { useProjectMembersQuery } from "@src/queries/useProjectMembersQuery";
import { initialsOf } from "@src/utils/initials";
import { pluralize } from "@src/utils/stringUtils";
import { PROJECT_ROLE_LABELS } from "../projectAccess";
import { ProjectAccessDialog } from "../ProjectAccessDialog/ProjectAccessDialog";
import { SectionLabel } from "../SectionLabel/SectionLabel";

export const DEPENDENCIES = { useProjectMembersQuery, useProjectAccess, useUser, ProjectAccessDialog };

export const MAX_PREVIEWED_MEMBERS = 5;

interface Props {
  project: { id: string; name: string };
  organizationName: string;
  dependencies?: typeof DEPENDENCIES;
}

/** Who was granted the project, a few at a time; owners and admins reach it without a grant, so they are named only in the footnote. */
export function ProjectMembersPreview({ project, organizationName, dependencies: d = DEPENDENCIES }: Props) {
  const { data: members = [], isLoading, isError } = d.useProjectMembersQuery(project.id);
  const { canManageAccess } = d.useProjectAccess();
  const { user } = d.useUser();
  const [isManagingAccess, setIsManagingAccess] = useState(false);
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
                <span className="text-xs text-muted-foreground">{PROJECT_ROLE_LABELS[member.role]}</span>
              </li>
            ))}
          </ul>
        )}

        {hiddenCount > 0 && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">and {hiddenCount} more</p>}

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Owners and admins can open every project.</p>
          {canManageAccess(project.id) && (
            <Button variant="outline" size="xs" className="shrink-0 gap-1.5 text-xs" onClick={() => setIsManagingAccess(true)}>
              <UserCog className="h-3.5 w-3.5" aria-hidden />
              Manage access
            </Button>
          )}
        </div>
      </div>

      {isManagingAccess && (
        <d.ProjectAccessDialog project={project} organizationName={organizationName} viewerUserId={user?.id} onClose={() => setIsManagingAccess(false)} />
      )}
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
