import React from "react";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { NotificationChannelCreateContainer } from "@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer";
import { NotificationChannelForm } from "@src/components/alerts/NotificationChannelForm/NotificationChannelForm";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { useBackNav } from "@src/hooks/useBackNav";
import { useNavigationGuard } from "@src/hooks/useNavigationGuard/useNavigationGuard";
import { UrlService } from "@src/utils/urlUtils";

export const CreateNotificationChannelPage: React.FunctionComponent = () => {
  const goBack = useBackNav(UrlService.notificationChannels());
  const navGuard = useNavigationGuard();

  return (
    <Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Create Notification Channel" />
      <div className="mt-4 flex flex-wrap items-center py-4">
        <Link href="." type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Create Notification Channel</Title>
      </div>
      <NotificationChannelCreateContainer
        onCreate={() => {
          navGuard.toggle({ hasChanges: false });
          goBack();
        }}
      >
        {props => <NotificationChannelForm isLoading={props.isLoading} onSubmit={props.create} onCancel={goBack} onStateChange={navGuard.toggle} />}
      </NotificationChannelCreateContainer>
    </Layout>
  );
};
