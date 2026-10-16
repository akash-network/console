"use client";
import type { FC } from "react";
import { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  Snackbar
} from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { formatDistanceStrict } from "date-fns";
import { Crown, MoreHorizontal, Pencil, TriangleAlert, UserMinus } from "lucide-react";
import { useSnackbar } from "notistack";

import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { EditMemberDialog } from "@src/components/organizations/EditMemberDialog/EditMemberDialog";
import { getMembershipErrorMessage } from "@src/components/organizations/membershipErrorMessages";
import { canManageMembers, ORGANIZATION_ROLE_LABELS } from "@src/components/organizations/organizationAccess";
import { hueOf } from "@src/components/organizations/OrganizationAvatar/OrganizationAvatar";
import type { EditableRole } from "@src/components/organizations/organizationRoles";
import { getMemberDisplayName, getRoleRank } from "@src/components/organizations/organizationRoles";
import { useDeleteOrganizationMemberMutation, useTransferOrganizationOwnershipMutation } from "@src/queries/useOrganizationMembersQueries";
import type { OrganizationRole } from "@src/types/organization";
import type { OrganizationMemberOutput } from "@src/types/organizationMembership";

export const DEPENDENCIES = {
  usePopup,
  useSnackbar,
  useDeleteOrganizationMemberMutation,
  useTransferOrganizationOwnershipMutation,
  EditMemberDialog
};

type EditableMember = OrganizationMemberOutput & { role: EditableRole };

type Props = {
  members: OrganizationMemberOutput[] | undefined;
  isLoading: boolean;
  isError: boolean;
  organizationName: string;
  viewerRole: OrganizationRole;
  viewerUserId: string | undefined;
  dependencies?: typeof DEPENDENCIES;
};

export const MemberRoster: FC<Props> = ({ members, isLoading, isError, organizationName, viewerRole, viewerUserId, dependencies: d = DEPENDENCIES }) => {
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: deleteMember } = d.useDeleteOrganizationMemberMutation();
  const { mutate: transferOwnership } = d.useTransferOrganizationOwnershipMutation();
  const [editedMember, setEditedMember] = useState<EditableMember>();
  const now = new Date();
  const canManage = canManageMembers(viewerRole);
  const roster = [...(members ?? [])].sort(
    (a, b) => getRoleRank(a.role) - getRoleRank(b.role) || getMemberDisplayName(a).localeCompare(getMemberDisplayName(b))
  );
  const adminCount = roster.filter(member => getRoleRank(member.role) < 2).length;

  const notifySuccess = (title: string) => enqueueSnackbar(<Snackbar title={title} iconVariant="success" />, { variant: "success" });
  const notifyFailure = (error: unknown, fallback: string) =>
    enqueueSnackbar(<Snackbar title={getMembershipErrorMessage(error, fallback)} iconVariant="error" />, { variant: "error" });

  const isManageable = (member: OrganizationMemberOutput): member is EditableMember => canManage && member.userId !== viewerUserId && member.role !== "owner";

  const removeMember = async (member: OrganizationMemberOutput) => {
    const name = getMemberDisplayName(member);
    const isConfirmed = await confirm({
      title: `Remove ${name}?`,
      message: `${name} loses access to ${organizationName} and its projects right away. Their deployments keep running.`
    });
    if (!isConfirmed) return;

    deleteMember(
      { id: member.id },
      {
        onSuccess: () => notifySuccess(`${name} was removed from ${organizationName}`),
        onError: error => notifyFailure(error, `Couldn't remove ${name}`)
      }
    );
  };

  const handOverOwnership = async (member: OrganizationMemberOutput) => {
    const name = getMemberDisplayName(member);
    const isConfirmed = await confirm({
      title: `Transfer ownership to ${name}?`,
      message: `${name} becomes the owner of ${organizationName}. You stay on as an Admin. Only the owner can transfer ownership.`
    });
    if (!isConfirmed) return;

    transferOwnership(
      { id: member.id },
      {
        onSuccess: () => notifySuccess(`${name} is now the owner of ${organizationName}`),
        onError: error => notifyFailure(error, `Couldn't transfer ownership to ${name}`)
      }
    );
  };

  return (
    <SettingsSection
      title="Members"
      aside={
        members && (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {pluralize(roster.length, "member")} · {pluralize(adminCount, "admin")}
          </span>
        )
      }
    >
      <Card className="overflow-hidden rounded-xl shadow-none">
        {isLoading && <MemberRosterSkeleton />}
        {isError && !members && (
          <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
            <TriangleAlert className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold">Couldn&apos;t load the members</p>
            <p className="text-xs text-muted-foreground">Refresh the page to try again.</p>
          </div>
        )}
        {roster.length > 0 && (
          <ul aria-label="Members" className="divide-y">
            {roster.map(member => (
              <MemberRow
                key={member.id}
                member={member}
                now={now}
                isViewer={member.userId === viewerUserId}
                isManageable={isManageable(member)}
                canTransferOwnership={viewerRole === "owner"}
                onEdit={() => isManageable(member) && setEditedMember(member)}
                onRemove={() => removeMember(member)}
                onTransferOwnership={() => handOverOwnership(member)}
              />
            ))}
          </ul>
        )}
      </Card>
      {editedMember && <d.EditMemberDialog member={editedMember} organizationName={organizationName} onClose={() => setEditedMember(undefined)} />}
    </SettingsSection>
  );
};

type MemberRowProps = {
  member: OrganizationMemberOutput;
  now: Date;
  isViewer: boolean;
  isManageable: boolean;
  canTransferOwnership: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onTransferOwnership: () => void;
};

const MemberRow: FC<MemberRowProps> = ({ member, now, isViewer, isManageable, canTransferOwnership, onEdit, onRemove, onTransferOwnership }) => {
  const name = getMemberDisplayName(member);
  const isOwner = member.role === "owner";

  return (
    <li className="flex items-center gap-3.5 px-4 py-3">
      <MemberAvatar name={name} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold">{name}</span>
          {isViewer && <MemberTag>You</MemberTag>}
          {isOwner && <MemberTag>Owner</MemberTag>}
        </div>
        {member.email && member.email !== name && <span className="truncate text-xs text-muted-foreground">{member.email}</span>}
      </div>
      <span className="hidden whitespace-nowrap font-mono text-[11px] text-muted-foreground sm:inline">
        Joined {formatDistanceStrict(new Date(member.createdAt), now, { addSuffix: true })}
      </span>
      <div className="flex w-[124px] shrink-0 flex-col gap-0.5">
        <span className="text-sm">{ORGANIZATION_ROLE_LABELS[isOwner ? "admin" : member.role]}</span>
        <MemberProjectAccess member={member} />
      </div>
      <div className="flex w-7 shrink-0 justify-end">
        {isManageable && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button aria-label={`Actions for ${name}`} size="icon" variant="ghost" className="h-7 w-7 rounded-md text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit member
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canTransferOwnership && (
                <>
                  <DropdownMenuItem onSelect={onTransferOwnership}>
                    <Crown className="mr-2 h-4 w-4" />
                    Transfer ownership
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onRemove}>
                <UserMinus className="mr-2 h-4 w-4" />
                Remove from organization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
};

const MemberProjectAccess: FC<{ member: OrganizationMemberOutput }> = ({ member }) => {
  if (member.projectAccess === "all") return <span className="text-xs text-muted-foreground">All projects</span>;
  if (member.projectAccess !== "selected") return null;
  if (member.projectCount) return <span className="text-xs text-muted-foreground">{pluralize(member.projectCount, "project")}</span>;

  return (
    <span className="flex items-center gap-1 text-xs text-warning">
      <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
      No projects
    </span>
  );
};

const MemberTag: FC<{ children: string }> = ({ children }) => (
  <span className="inline-flex shrink-0 rounded-md border border-border bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">{children}</span>
);

const MemberAvatar: FC<{ name: string }> = ({ name }) => {
  const hue = hueOf(name);
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");

  return (
    <Avatar aria-hidden="true" className="h-[34px] w-[34px] shrink-0">
      <AvatarFallback
        className="text-xs font-semibold"
        style={{ background: `oklch(0.94 0.04 ${hue})`, color: `oklch(0.42 0.12 ${hue})`, boxShadow: `inset 0 0 0 1px oklch(0.86 0.06 ${hue})` }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

const MemberRosterSkeleton: FC = () => (
  <div className="flex flex-col gap-5 px-4 py-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="flex items-center gap-3.5">
        <Skeleton className="h-[34px] w-[34px] rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
    ))}
  </div>
);

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
