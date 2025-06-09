import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { NotificationChannelEditContainer } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { NotificationChannelForm } from "@src/components/alerts/NotificationChannelForm/NotificationChannelForm";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { useBackNav } from "@src/hooks/useBackNav";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  notificationChannel: components["schemas"]["NotificationChannelOutput"]["data"];
};

export const EditNotificationChannelPage: React.FunctionComponent<Props> = ({ notificationChannel }: Props) => {
  const goBack = useBackNav(UrlService.notificationChannels());

  return (
    <Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Edit Notification Channel" />
      <div className="mt-4 flex flex-wrap items-center py-4">
        <Link href="." type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Edit Notification Channel</Title>
      </div>
      <NotificationChannelEditContainer id={notificationChannel.id} onEditSuccess={goBack}>
        {props => (
          <NotificationChannelForm
            initialValues={{
              name: notificationChannel.name,
              emails: notificationChannel.config.addresses
            }}
            isLoading={props.isLoading}
            onSubmit={props.onEdit}
            onCancel={goBack}
          />
        )}
      </NotificationChannelEditContainer>
    </Layout>
  );
};
