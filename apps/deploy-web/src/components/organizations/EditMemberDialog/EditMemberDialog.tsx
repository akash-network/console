"use client";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import {
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
  RadioGroup,
  Snackbar
} from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { getMembershipErrorMessage } from "@src/components/organizations/membershipErrorMessages";
import { ORGANIZATION_ROLE_LABELS } from "@src/components/organizations/organizationAccess";
import type { EditableRole } from "@src/components/organizations/organizationRoles";
import { EDITABLE_ROLE_DESCRIPTIONS, getEditableRolesFor, getMemberDisplayName } from "@src/components/organizations/organizationRoles";
import type { ProjectAccessValue } from "@src/components/organizations/ProjectAccessField/ProjectAccessField";
import { hasProjectAccess, ProjectAccessField, toProjectAccessRequest } from "@src/components/organizations/ProjectAccessField/ProjectAccessField";
import { RadioCard } from "@src/components/organizations/RadioCard/RadioCard";
import { holdsProjectGrants } from "@src/components/projects/projectAccess";
import { useOrganizationMemberProjectGrantsQuery, useUpdateOrganizationMemberMutation } from "@src/queries/useOrganizationMembersQueries";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import type { OrganizationMemberOutput } from "@src/types/organizationMembership";

export const DEPENDENCIES = { useSnackbar, useUpdateOrganizationMemberMutation, useOrganizationMemberProjectGrantsQuery, useProjectsQuery, ProjectAccessField };

type Props = {
  member: OrganizationMemberOutput & { role: EditableRole };
  organizationName: string;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** Changes a member's role and project access in one save, starting from the access and grants they hold today. */
export function EditMemberDialog({ member, organizationName, onClose, dependencies: d = DEPENDENCIES }: Props) {
  const formId = useId();
  const name = getMemberDisplayName(member);
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: updateMember, isPending } = d.useUpdateOrganizationMemberMutation();
  const holdsGrantsToday = holdsProjectGrants(member.role);
  const grantsQuery = d.useOrganizationMemberProjectGrantsQuery(member.id, { enabled: holdsGrantsToday });
  const { data: projects = [] } = d.useProjectsQuery();
  const [role, setRole] = useState<EditableRole>(member.role);
  const [editedAccess, setEditedAccess] = useState<ProjectAccessValue>();
  const projectAccess = editedAccess ?? {
    access: holdsGrantsToday && member.projectAccess === "selected" ? "selected" : "all",
    grants: grantsQuery.data ?? []
  };
  const carriesProjectAccess = holdsProjectGrants(role);
  const isGrantsUnread = holdsGrantsToday && !grantsQuery.data;
  const isChanged = role !== member.role || !!editedAccess;
  const canSave = isChanged && !isPending && (!carriesProjectAccess || (!isGrantsUnread && hasProjectAccess(projectAccess)));

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    updateMember(
      { id: member.id, data: { role, ...(carriesProjectAccess && toProjectAccessRequest(projectAccess)) } },
      {
        onSuccess: () => {
          enqueueSnackbar(<Snackbar title={`Saved ${name}'s role and access`} iconVariant="success" />, { variant: "success" });
          onClose();
        },
        onError: error => {
          const title = getMembershipErrorMessage(error, `Couldn't save ${name}'s changes`);
          enqueueSnackbar(<Snackbar title={title} iconVariant="error" />, { variant: "error" });
        }
      }
    );
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[520px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Edit {name}</DialogV2Title>
          <DialogV2Description>Changes apply as soon as you save.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-4" onSubmit={save}>
            <div className="flex flex-col gap-1.5">
              <Label id={`${formId}-role`}>Role</Label>
              <RadioGroup
                aria-labelledby={`${formId}-role`}
                value={role}
                onValueChange={value => setRole(value as EditableRole)}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {getEditableRolesFor(member.role).map(option => (
                  <RadioCard
                    key={option}
                    id={`${formId}-role-${option}`}
                    value={option}
                    label={ORGANIZATION_ROLE_LABELS[option]}
                    description={EDITABLE_ROLE_DESCRIPTIONS[option]}
                  />
                ))}
              </RadioGroup>
            </div>

            {carriesProjectAccess && grantsQuery.isError && (
              <p className="text-xs text-destructive">Couldn&apos;t load {name}&apos;s projects. Try again later.</p>
            )}
            {carriesProjectAccess && !isGrantsUnread && (
              <d.ProjectAccessField organizationName={organizationName} projects={projects} value={projectAccess} onChange={setEditedAccess} />
            )}
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isPending} disabled={!canSave}>
            Save
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
}
