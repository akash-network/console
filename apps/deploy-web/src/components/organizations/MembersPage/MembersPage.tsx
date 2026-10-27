"use client";
import { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { AdminAccessRequestNotice } from "@src/components/organizations/AdminAccessRequestNotice/AdminAccessRequestNotice";
import { InviteMembersDialog } from "@src/components/organizations/InviteMembersDialog/InviteMembersDialog";
import { MemberRoster } from "@src/components/organizations/MemberRoster/MemberRoster";
import { canManageMembers, hasMembersPage } from "@src/components/organizations/organizationAccess";
import { PendingInvitationList } from "@src/components/organizations/PendingInvitationList/PendingInvitationList";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useOrganizationInvitationsQuery } from "@src/queries/useOrganizationInvitationsQueries";
import { useOrganizationMembersQuery } from "@src/queries/useOrganizationMembersQueries";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Layout,
  SettingsLayout,
  NextSeo,
  MemberRoster,
  PendingInvitationList,
  InviteMembersDialog,
  AdminAccessRequestNotice,
  useFlag,
  useActiveOrganization,
  useUser,
  useRouter,
  useOrganizationMembersQuery,
  useOrganizationInvitationsQuery
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function MembersPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const isEnabled = d.useFlag("organizations");
  const { activeOrganization, isError: hasNoOrganizations } = d.useActiveOrganization();
  const { user } = d.useUser();
  const router = d.useRouter();
  const [isInviting, setIsInviting] = useState(false);
  const organization = isEnabled && activeOrganization && hasMembersPage(activeOrganization.type) ? activeOrganization : undefined;
  const isUnavailable = !isEnabled || hasNoOrganizations || (!!activeOrganization && !organization);
  const canManage = !!organization && canManageMembers(organization.role);
  const members = d.useOrganizationMembersQuery({ enabled: !!organization });
  const invitations = d.useOrganizationInvitationsQuery({ enabled: canManage });

  useEffect(
    function leaveWhenOrganizationHasNoMembers() {
      if (isUnavailable) router.replace(UrlService.home());
    },
    [isUnavailable, router]
  );

  if (!organization) return <d.Layout isLoading disableContainer />;

  return (
    <d.Layout background="dots" disableContainer>
      <d.NextSeo title="Members" />

      <d.SettingsLayout
        title="Members"
        headerActions={
          canManage && (
            <Button size="sm" className="gap-1.5" onClick={() => setIsInviting(true)}>
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Invite members
            </Button>
          )
        }
      >
        {!canManage && <d.AdminAccessRequestNotice organization={organization} adminOnlyAction="invite people or change roles" />}

        <d.MemberRoster
          members={members.data}
          isLoading={members.isLoading}
          isError={members.isError}
          organizationName={organization.name}
          viewerRole={organization.role}
          viewerUserId={user?.id}
        />

        {canManage && <d.PendingInvitationList invitations={invitations.data} isLoading={invitations.isLoading} />}
      </d.SettingsLayout>

      {isInviting && (
        <d.InviteMembersDialog
          organizationName={organization.name}
          memberEmails={(members.data ?? []).flatMap(member => (member.email ? [member.email] : []))}
          invitedEmails={(invitations.data ?? []).flatMap(invitation => (new Date(invitation.expiresAt) > new Date() ? [invitation.email] : []))}
          onClose={() => setIsInviting(false)}
        />
      )}
    </d.Layout>
  );
}
