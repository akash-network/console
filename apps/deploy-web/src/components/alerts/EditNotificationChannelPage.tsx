import React, { useCallback } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { NotificationChannelEditContainer } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { NotificationChannelForm } from "@src/components/alerts/NotificationChannelForm/NotificationChannelForm";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { useBackNav } from "@src/hooks/useBackNav";
import { useNavigationGuard } from "@src/hooks/useNavigationGuard/useNavigationGuard";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { Layout, NotificationChannelEditContainer, NotificationChannelForm, useBackNav, useNavigationGuard };

type Props = {
  notificationChannel: components["schemas"]["NotificationChannelOutput"]["data"];
  dependencies?: typeof DEPENDENCIES;
};

export const EditNotificationChannelPage: React.FunctionComponent<Props> = ({ notificationChannel, dependencies: d = DEPENDENCIES }: Props) => {
  const goBack = d.useBackNav(UrlService.alerts());
  const navGuard = d.useNavigationGuard();
  const saveNavStateAndGoBack = useCallback(() => {
    navGuard.toggle({ hasChanges: false });
    goBack();
  }, [goBack, navGuard]);

  return (
    <d.Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Edit Notification Channel" />
      <div className="flex flex-wrap items-center px-6 py-6">
        <Link href={UrlService.alerts()} type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Edit Notification Channel</Title>
      </div>
      <d.NotificationChannelEditContainer id={notificationChannel.id} onEditSuccess={saveNavStateAndGoBack}>
        {props => (
          <d.NotificationChannelForm
            initialValues={{
              name: notificationChannel.name,
              emails: notificationChannel.config.addresses
            }}
            isLoading={props.isLoading}
            onSubmit={props.onEdit}
            onCancel={goBack}
            onStateChange={navGuard.toggle}
          />
        )}
      </d.NotificationChannelEditContainer>
    </d.Layout>
  );
};
