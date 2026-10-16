"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { LogOut } from "lucide-react";
import Link from "next/link";

import { SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { useOrganizationMembersQuery } from "@src/queries/useOrganizationMembersQueries";
import type { OrganizationOutput } from "@src/types/organization";
import { UrlService } from "@src/utils/urlUtils";
import { LeaveOrganizationDialog } from "./LeaveOrganizationDialog";

export const DEPENDENCIES = { useOrganizationMembersQuery, LeaveOrganizationDialog };

type Props = {
  organization: Pick<OrganizationOutput, "id" | "name" | "role">;
  dependencies?: typeof DEPENDENCIES;
};

export const LeaveOrganizationSetting: FC<Props> = ({ organization, dependencies: d = DEPENDENCIES }) => {
  const isOwner = organization.role === "owner";
  const members = d.useOrganizationMembersQuery({ enabled: isOwner });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <SettingsRow label="Leave organization" description={describeLeaving(organization.name, { isOwner, isOnlyMember: members.data?.length === 1 })}>
        <Button type="button" variant="outline" size="md" className="gap-1.5" disabled={isOwner} onClick={() => setIsDialogOpen(true)}>
          <LogOut className="h-4 w-4" aria-hidden />
          Leave organization
        </Button>
      </SettingsRow>
      {isDialogOpen && <d.LeaveOrganizationDialog organization={organization} onClose={() => setIsDialogOpen(false)} />}
    </>
  );
};

function describeLeaving(organizationName: string, { isOwner, isOnlyMember }: { isOwner: boolean; isOnlyMember: boolean }): ReactNode {
  if (!isOwner) return `You lose access to ${organizationName} and its projects. Deployments keep running.`;
  if (isOnlyMember) return `You're the only member of ${organizationName}. Delete it instead if you no longer need it.`;

  return (
    <>
      You own {organizationName}. Transfer ownership on the{" "}
      <Link href={UrlService.members()} className="font-medium text-foreground underline underline-offset-2">
        Members
      </Link>{" "}
      page before you leave.
    </>
  );
}
