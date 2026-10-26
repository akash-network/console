"use client";
import { useState } from "react";
import { Avatar, AvatarFallback, Button, Skeleton } from "@akashnetwork/ui/components";
import { UserCog } from "lucide-react";

import { useProjectAccess } from "@src/hooks/useProjectAccess/useProjectAccess";
import { useUser } from "@src/hooks/useUser";
import { useOrganizationMembersQuery } from "@src/queries/useOrganizationMembersQueries";
import { useProjectMembersQuery } from "@src/queries/useProjectMembersQuery";
import type { ProjectMember, ProjectRole } from "@src/types/project";
import { initialsOf } from "@src/utils/initials";
import { pluralize } from "@src/utils/stringUtils";
import { getMembersOnEveryProject, PROJECT_ROLE_LABELS } from "../projectAccess";
import { ProjectAccessDialog } from "../ProjectAccessDialog/ProjectAccessDialog";
import { SectionLabel } from "../SectionLabel/SectionLabel";

export const DEPENDENCIES = { useProjectMembersQuery, useOrganizationMembersQuery, useProjectAccess, useUser, ProjectAccessDialog };

export const MAX_PREVIEWED_MEMBERS = 5;

type PreviewedMember = Pick<ProjectMember, "userId" | "username" | "email"> & { projectRole?: ProjectRole };

interface Props {
  project: { id: string; name: string };
  organizationName: string;
  dependencies?: typeof DEPENDENCIES;
}

/** Who can open the project, a few at a time: the members granted it with their role, then everyone who reaches every project. */
export function ProjectMembersPreview({ project, organizationName, dependencies: d = DEPENDENCIES }: Props) {
  const grantsQuery = d.useProjectMembersQuery(project.id);
  const organizationMembersQuery = d.useOrganizationMembersQuery({ enabled: true });
  const { canManageAccess } = d.useProjectAccess();
  const { user } = d.useUser();
  const [isManagingAccess, setIsManagingAccess] = useState(false);
  const isLoading = grantsQuery.isLoading || organizationMembersQuery.isLoading;
  const isError = grantsQuery.isError || organizationMembersQuery.isError;
  const grants = grantsQuery.data ?? [];
  const membersOnEveryProject = getMembersOnEveryProject(organizationMembersQuery.data ?? [], new Set(grants.map(grant => grant.userId)));
  const members: PreviewedMember[] = [
    ...grants.map(({ userId, username, email, role }) => ({ userId, username, email, projectRole: role })),
    ...membersOnEveryProject.map(({ userId, username, email }) => ({ userId, username, email }))
  ];
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
              <li key={member.userId} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[11px] font-semibold">{initialsOf(member.username || member.email || "?")}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium">{member.username || member.email || "A member"}</span>
                  {!member.projectRole && (
                    <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                      All projects
                    </span>
                  )}
                </span>
                {member.projectRole && <span className="text-xs text-muted-foreground">{PROJECT_ROLE_LABELS[member.projectRole]}</span>}
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
