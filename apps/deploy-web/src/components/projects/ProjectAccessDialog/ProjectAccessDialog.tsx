"use client";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Label,
  LoadingButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Snackbar
} from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { UserMinus } from "lucide-react";
import { useSnackbar } from "notistack";

import { getMemberDisplayName } from "@src/components/organizations/organizationRoles";
import { useOrganizationMembersQuery } from "@src/queries/useOrganizationMembersQueries";
import {
  useCreateProjectMemberMutation,
  useDeleteProjectMemberMutation,
  useProjectMembersQuery,
  useUpdateProjectMemberMutation
} from "@src/queries/useProjectMembersQuery";
import type { ProjectMember, ProjectRole } from "@src/types/project";
import { initialsOf } from "@src/utils/initials";
import { getProjectAccessErrorMessage, holdsProjectGrants, PROJECT_ROLE_DESCRIPTIONS, PROJECT_ROLE_LABELS, PROJECT_ROLES } from "../projectAccess";
import { SectionLabel } from "../SectionLabel/SectionLabel";

export const DEPENDENCIES = {
  usePopup,
  useSnackbar,
  useProjectMembersQuery,
  useOrganizationMembersQuery,
  useCreateProjectMemberMutation,
  useUpdateProjectMemberMutation,
  useDeleteProjectMemberMutation
};

const DEFAULT_GRANT_ROLE: ProjectRole = "member";

const VIEWER_ROLES: ProjectRole[] = ["viewer"];

const LOADING_ROWS = ["first", "second"];

interface Props {
  project: { id: string; name: string };
  organizationName: string;
  viewerUserId: string | undefined;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/** Who may open a project beyond the owners and admins, and the controls to grant, change and revoke that access. */
export function ProjectAccessDialog({ project, organizationName, viewerUserId, onClose, dependencies: d = DEPENDENCIES }: Props) {
  const formId = useId();
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const grantsQuery = d.useProjectMembersQuery(project.id);
  const organizationMembersQuery = d.useOrganizationMembersQuery({ enabled: true });
  const { mutate: createGrant, isPending: isGranting } = d.useCreateProjectMemberMutation();
  const { mutate: updateGrant } = d.useUpdateProjectMemberMutation();
  const { mutate: deleteGrant } = d.useDeleteProjectMemberMutation();
  const [granteeUserId, setGranteeUserId] = useState("");
  const [grantRole, setGrantRole] = useState<ProjectRole>(DEFAULT_GRANT_ROLE);

  const grants = grantsQuery.data ?? [];
  const organizationMembers = organizationMembersQuery.data ?? [];
  const isLoadingAccess = grantsQuery.isLoading || organizationMembersQuery.isLoading;
  const organizationViewerIds = new Set(organizationMembers.filter(member => member.role === "viewer").map(member => member.userId));
  const grantedUserIds = new Set(grants.map(grant => grant.userId));
  const grantableMembers = organizationMembers.filter(
    member => holdsProjectGrants(member.role) && member.userId !== viewerUserId && !grantedUserIds.has(member.userId)
  );
  const grantee = grantableMembers.find(member => member.userId === granteeUserId);
  const isGranteeOrganizationViewer = !!grantee && organizationViewerIds.has(grantee.userId);

  const notifySuccess = (title: string) => enqueueSnackbar(<Snackbar title={title} iconVariant="success" />, { variant: "success" });
  const notifyFailure = (error: unknown, fallback: string) =>
    enqueueSnackbar(<Snackbar title={getProjectAccessErrorMessage(error, fallback)} iconVariant="error" />, { variant: "error" });

  const chooseGrantee = (userId: string) => {
    setGranteeUserId(userId);
    if (organizationViewerIds.has(userId)) setGrantRole("viewer");
  };

  const grantAccess = (event: FormEvent) => {
    event.preventDefault();
    if (!grantee) return;

    const name = getMemberDisplayName(grantee);
    createGrant(
      { data: { projectId: project.id, userId: grantee.userId, role: grantRole } },
      {
        onSuccess: () => {
          setGranteeUserId("");
          setGrantRole(DEFAULT_GRANT_ROLE);
          notifySuccess(`${name} can now open ${project.name}`);
        },
        onError: error => notifyFailure(error, `Couldn't give ${name} access`)
      }
    );
  };

  const changeRole = (grant: ProjectMember, role: ProjectRole) => {
    if (role === grant.role) return;

    const name = getMemberDisplayName(grant);
    updateGrant(
      { id: grant.id, data: { role } },
      {
        onSuccess: () => notifySuccess(`${name} is now a ${PROJECT_ROLE_LABELS[role]} of ${project.name}`),
        onError: error => notifyFailure(error, `Couldn't change ${name}'s access`)
      }
    );
  };

  const revokeAccess = async (grant: ProjectMember) => {
    const name = getMemberDisplayName(grant);
    const isConfirmed = await confirm({
      title: `Revoke ${name}'s access?`,
      message: `${name} can no longer open ${project.name}, starting right away. Its deployments keep running.`
    });
    if (!isConfirmed) return;

    deleteGrant(
      { id: grant.id },
      {
        onSuccess: () => notifySuccess(`${name} no longer has access to ${project.name}`),
        onError: error => notifyFailure(error, `Couldn't revoke ${name}'s access`)
      }
    );
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[560px]">
        <DialogV2Header>
          <DialogV2Title>Access to {project.name}</DialogV2Title>
          <DialogV2Description>Owners and admins of {organizationName} open every project without being added here.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body className="flex flex-col gap-5">
          <form id={formId} className="flex flex-col gap-1.5" onSubmit={grantAccess}>
            <Label id={`${formId}-grantee`}>Give access to</Label>
            {isLoadingAccess || grantableMembers.length > 0 ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={granteeUserId} onValueChange={chooseGrantee} disabled={isLoadingAccess}>
                    <SelectTrigger aria-labelledby={`${formId}-grantee`} className="h-9 min-w-0 flex-1">
                      <SelectValue placeholder="Choose a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {grantableMembers.map(member => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {getMemberDisplayName(member)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ProjectRoleSelect
                    label="Role for the new member"
                    roles={isGranteeOrganizationViewer ? VIEWER_ROLES : PROJECT_ROLES}
                    value={grantRole}
                    onChange={setGrantRole}
                  />
                  <LoadingButton type="submit" size="sm" className="h-9" loading={isGranting} disabled={!grantee}>
                    Give access
                  </LoadingButton>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isGranteeOrganizationViewer
                    ? `Viewers of ${organizationName} only view projects, whatever role they are given.`
                    : `${PROJECT_ROLE_LABELS[grantRole]}: ${PROJECT_ROLE_DESCRIPTIONS[grantRole]}`}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">Every member and viewer of {organizationName} already has access to this project.</p>
            )}
          </form>

          <div>
            <SectionLabel
              rightSlot={
                !grantsQuery.isLoading && (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {grants.length} {grants.length === 1 ? "person" : "people"}
                  </span>
                )
              }
            >
              People with access
            </SectionLabel>
            {grantsQuery.isLoading ? (
              <div aria-label="Loading people with access" className="flex flex-col gap-3 rounded-[10px] border border-border px-3.5 py-3">
                {LOADING_ROWS.map(row => (
                  <div key={row} className="flex items-center gap-3">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="ml-auto h-8 w-[112px]" />
                  </div>
                ))}
              </div>
            ) : grants.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border px-4 py-5 text-center text-[12.5px] text-muted-foreground">
                No one has been given access to this project yet.
              </p>
            ) : (
              <ul aria-label="People with access" className="divide-y divide-border rounded-[10px] border border-border">
                {grants.map(grant => (
                  <GrantRow
                    key={grant.id}
                    grant={grant}
                    isCaller={grant.userId === viewerUserId}
                    isOrganizationViewer={organizationViewerIds.has(grant.userId)}
                    onChangeRole={role => changeRole(grant, role)}
                    onRevoke={() => revokeAccess(grant)}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogV2Body>

        <DialogV2Footer className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
}

interface GrantRowProps {
  grant: ProjectMember;
  isCaller: boolean;
  isOrganizationViewer: boolean;
  onChangeRole: (role: ProjectRole) => void;
  onRevoke: () => void;
}

function GrantRow({ grant, isCaller, isOrganizationViewer, onChangeRole, onRevoke }: GrantRowProps) {
  const name = getMemberDisplayName(grant);
  const roles = isOrganizationViewer ? PROJECT_ROLES.filter(role => role === "viewer" || role === grant.role) : PROJECT_ROLES;

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <Avatar aria-hidden="true" className="h-7 w-7 shrink-0">
        <AvatarFallback className="text-[11px] font-semibold">{initialsOf(name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 truncate text-[13px] font-medium">
          {name}
          {isCaller && <RowTag>You</RowTag>}
          {isOrganizationViewer && <RowTag>View only</RowTag>}
        </span>
        {grant.email && grant.email !== name && <span className="truncate text-xs text-muted-foreground">{grant.email}</span>}
      </div>
      {isCaller ? (
        <span className="px-3 text-sm">{PROJECT_ROLE_LABELS[grant.role]}</span>
      ) : (
        <>
          <ProjectRoleSelect label={`Role for ${name}`} roles={roles} value={grant.role} onChange={onChangeRole} />
          <Button
            type="button"
            aria-label={`Revoke access for ${name}`}
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
            onClick={onRevoke}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        </>
      )}
    </li>
  );
}

function RowTag({ children }: { children: string }) {
  return <span className="rounded-md border border-border bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">{children}</span>;
}

function ProjectRoleSelect({
  label,
  roles,
  value,
  onChange
}: {
  label: string;
  roles: ProjectRole[];
  value: ProjectRole;
  onChange: (role: ProjectRole) => void;
}) {
  return (
    <Select value={value} onValueChange={role => onChange(role as ProjectRole)}>
      <SelectTrigger aria-label={label} className="h-9 w-[112px] shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map(role => (
          <SelectItem key={role} value={role}>
            {PROJECT_ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
