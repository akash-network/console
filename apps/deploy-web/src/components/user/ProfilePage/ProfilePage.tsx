"use client";
import type { FC } from "react";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { SettingsCard, SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { DeleteAccountSection } from "@src/components/user/DeleteAccount/DeleteAccountSection";
import { ProductUpdatesSetting } from "@src/components/user/ProductUpdatesSetting/ProductUpdatesSetting";
import { UsernameSetting } from "@src/components/user/UsernameSetting/UsernameSetting";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { CustomUserProfile } from "@src/types/user";

export const DEPENDENCIES = { Layout, NextSeo, UsernameSetting, ProductUpdatesSetting, DeleteAccountSection, useCustomUser };

type Props = {
  user: CustomUserProfile;
  dependencies?: typeof DEPENDENCIES;
};

export const ProfilePage: FC<Props> = ({ user, dependencies: d = DEPENDENCIES }) => {
  const { isLoading } = d.useCustomUser();

  return (
    <d.Layout isLoading={isLoading} disableContainer>
      <d.NextSeo title="Profile" />

      <div className="flex h-[calc(100dvh_-_var(--app-header-height,57px)_-_4px)] flex-col">
        <div className="flex min-h-[60px] shrink-0 items-center border-b border-border bg-background px-4 py-2.5 sm:px-6">
          <h1 className="text-xl font-bold leading-7 tracking-[-0.02em]">Profile</h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[768px] flex-col gap-6 px-4 pb-12 pt-5 sm:px-6">
            <SettingsSection title="Account">
              <SettingsCard>
                <SettingsRow label="Email" description="The address you sign in with.">
                  <span className="text-sm [overflow-wrap:anywhere]">{user.email}</span>
                </SettingsRow>
                <d.UsernameSetting username={user.username} />
              </SettingsCard>
            </SettingsSection>

            <SettingsSection title="Email">
              <SettingsCard>
                <d.ProductUpdatesSetting user={user} />
              </SettingsCard>
            </SettingsSection>

            <d.DeleteAccountSection email={user.email} />
          </div>
        </div>
      </div>
    </d.Layout>
  );
};
