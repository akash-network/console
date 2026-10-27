"use client";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { SettingsCard, SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { AdminAccessRequestNotice } from "@src/components/organizations/AdminAccessRequestNotice/AdminAccessRequestNotice";
import { DeleteTeamSetting } from "@src/components/organizations/DeleteTeam/DeleteTeamSetting";
import { LeaveOrganizationSetting } from "@src/components/organizations/LeaveOrganization/LeaveOrganizationSetting";
import { canRenameOrganization, canTransferOwnership, hasGeneralSettingsPage } from "@src/components/organizations/organizationAccess";
import { ORGANIZATION_NAME_DESCRIPTION, OrganizationNameSetting } from "@src/components/organizations/OrganizationNameSetting/OrganizationNameSetting";
import { OwnershipTransferSetting } from "@src/components/organizations/OwnershipTransferSetting/OwnershipTransferSetting";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Layout,
  SettingsLayout,
  NextSeo,
  OrganizationNameSetting,
  OwnershipTransferSetting,
  AdminAccessRequestNotice,
  LeaveOrganizationSetting,
  DeleteTeamSetting,
  useFlag,
  useActiveOrganization,
  useRouter
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function OrganizationSettingsPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const isEnabled = d.useFlag("organizations");
  const { activeOrganization, isError: hasNoOrganizations } = d.useActiveOrganization();
  const router = d.useRouter();
  const organization = isEnabled && activeOrganization && hasGeneralSettingsPage(activeOrganization.type) ? activeOrganization : undefined;
  const isUnavailable = !isEnabled || hasNoOrganizations || (!!activeOrganization && !organization);

  useEffect(
    function leaveWhenOrganizationHasNoSettings() {
      if (isUnavailable) router.replace(UrlService.home());
    },
    [isUnavailable, router]
  );

  if (!organization) return <d.Layout isLoading disableContainer />;

  const canRename = canRenameOrganization(organization.role);

  return (
    <d.Layout background="dots" disableContainer>
      <d.NextSeo title="General" />

      <d.SettingsLayout title="General">
        <div className="mx-auto flex w-full max-w-[768px] flex-col gap-6">
          {!canRename && <d.AdminAccessRequestNotice organization={organization} adminOnlyAction="rename it" />}

          <SettingsSection title="Organization">
            <SettingsCard>
              {canRename ? (
                <d.OrganizationNameSetting organization={organization} />
              ) : (
                <SettingsRow label="Name" description={ORGANIZATION_NAME_DESCRIPTION}>
                  <span className="text-sm [overflow-wrap:anywhere]">{organization.name}</span>
                </SettingsRow>
              )}
            </SettingsCard>
          </SettingsSection>

          {canTransferOwnership(organization.role) && (
            <SettingsSection title="Ownership">
              <SettingsCard>
                <d.OwnershipTransferSetting organization={organization} />
              </SettingsCard>
            </SettingsSection>
          )}

          <SettingsSection title="Danger zone">
            <SettingsCard destructive>
              <d.LeaveOrganizationSetting organization={organization} />
              <d.DeleteTeamSetting organization={organization} />
            </SettingsCard>
          </SettingsSection>
        </div>
      </d.SettingsLayout>
    </d.Layout>
  );
}
