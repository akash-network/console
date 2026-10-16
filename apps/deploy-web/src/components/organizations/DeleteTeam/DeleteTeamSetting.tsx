"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Trash2 } from "lucide-react";

import { SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { canDeleteOrganization } from "@src/components/organizations/organizationAccess";
import { getMemberDisplayName } from "@src/components/organizations/organizationRoles";
import { useOrganizationMembersQuery } from "@src/queries/useOrganizationMembersQueries";
import type { OrganizationOutput } from "@src/types/organization";
import { DeleteTeamDialog } from "./DeleteTeamDialog";

export const DEPENDENCIES = { useOrganizationMembersQuery, DeleteTeamDialog };

type Props = {
  organization: Pick<OrganizationOutput, "id" | "name" | "role">;
  dependencies?: typeof DEPENDENCIES;
};

const ownerNamesFormat = new Intl.ListFormat("en");

export const DeleteTeamSetting: FC<Props> = ({ organization, dependencies: d = DEPENDENCIES }) => {
  const canDelete = canDeleteOrganization(organization.role);
  const members = d.useOrganizationMembersQuery({ enabled: !canDelete });
  const ownerNames = (members.data ?? []).filter(member => member.role === "owner").map(getMemberDisplayName);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <SettingsRow label="Delete organization" description={describeDeletion(organization.name, { canDelete, ownerNames })}>
        <Button type="button" variant="destructive" size="md" className="gap-1.5" disabled={!canDelete} onClick={() => setIsDialogOpen(true)}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete organization
        </Button>
      </SettingsRow>
      {isDialogOpen && <d.DeleteTeamDialog organization={organization} onClose={() => setIsDialogOpen(false)} />}
    </>
  );
};

function describeDeletion(organizationName: string, { canDelete, ownerNames }: { canDelete: boolean; ownerNames: string[] }): string {
  if (canDelete) return `Permanently delete ${organizationName} for everyone in it, forfeiting its remaining credits. This can't be undone.`;
  if (ownerNames.length === 0) return `Only the owner can delete ${organizationName}.`;
  if (ownerNames.length === 1) return `Only the owner, ${ownerNames[0]}, can delete ${organizationName}.`;

  return `Only the owners, ${ownerNamesFormat.format(ownerNames)}, can delete ${organizationName}.`;
}
