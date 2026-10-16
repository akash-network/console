"use client";
import type { FC } from "react";
import { useState } from "react";
import { LoadingButton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Snackbar } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { Crown } from "lucide-react";
import { useSnackbar } from "notistack";

import { SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { getMembershipErrorMessage } from "@src/components/organizations/membershipErrorMessages";
import { getMemberDisplayName } from "@src/components/organizations/organizationRoles";
import { useOrganizationMembersQuery, useTransferOrganizationOwnershipMutation } from "@src/queries/useOrganizationMembersQueries";
import type { OrganizationOutput } from "@src/types/organization";

export const DEPENDENCIES = { usePopup, useSnackbar, useOrganizationMembersQuery, useTransferOrganizationOwnershipMutation };

type Props = {
  organization: Pick<OrganizationOutput, "name">;
  dependencies?: typeof DEPENDENCIES;
};

export const OwnershipTransferSetting: FC<Props> = ({ organization, dependencies: d = DEPENDENCIES }) => {
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const members = d.useOrganizationMembersQuery({ enabled: true });
  const { mutate: transferOwnership, isPending } = d.useTransferOrganizationOwnershipMutation();
  const [newOwnerId, setNewOwnerId] = useState("");

  const candidates = (members.data ?? [])
    .filter(member => member.role !== "owner")
    .sort((a, b) => getMemberDisplayName(a).localeCompare(getMemberDisplayName(b)));
  const newOwner = candidates.find(member => member.id === newOwnerId);
  const hasNoCandidates = !!members.data && candidates.length === 0;

  const handOverOwnership = async () => {
    if (!newOwner) return;

    const name = getMemberDisplayName(newOwner);
    const isConfirmed = await confirm({
      title: `Transfer ownership to ${name}?`,
      message: `${name} becomes the owner of ${organization.name}. You stay on as an Admin.`
    });
    if (!isConfirmed) return;

    transferOwnership(
      { id: newOwner.id },
      {
        onSuccess: () => enqueueSnackbar(<Snackbar title={`${name} is now the owner of ${organization.name}`} iconVariant="success" />, { variant: "success" }),
        onError: error =>
          enqueueSnackbar(<Snackbar title={getMembershipErrorMessage(error, `Couldn't transfer ownership to ${name}`)} iconVariant="error" />, {
            variant: "error"
          })
      }
    );
  };

  return (
    <SettingsRow
      label="Transfer ownership"
      description={
        hasNoCandidates
          ? `You're the only member of ${organization.name}. Invite someone before you hand it over.`
          : `Make another member the owner of ${organization.name}. You stay on as an Admin.`
      }
    >
      <Select value={newOwnerId} onValueChange={setNewOwnerId} disabled={candidates.length === 0}>
        <SelectTrigger aria-label="New owner" className="h-9 w-[200px]">
          <SelectValue placeholder="Choose a member" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map(member => (
            <SelectItem key={member.id} value={member.id}>
              {getMemberDisplayName(member)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LoadingButton type="button" variant="outline" size="md" className="gap-1.5" loading={isPending} disabled={!newOwner} onClick={handOverOwnership}>
        <Crown className="h-4 w-4" aria-hidden />
        Transfer
      </LoadingButton>
    </SettingsRow>
  );
};
