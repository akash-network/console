import React, { type FC } from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { AlertsListContainer } from "@src/components/alerts/AlertsListContainer/AlertsListContainer";
import { AlertsListView } from "@src/components/alerts/AlertsListView/AlertsListView";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListView } from "@src/components/alerts/NotificationChannelsListView/NotificationChannelsListView";
import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";

export const AlertsPage: FC = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Alerts" />
      <SettingsLayout title="Alerts" description="Get notified about your deployments and manage where alerts are sent.">
        <section className="space-y-4">
          <Title subTitle>Configured Alerts</Title>
          <AlertsListContainer>{props => <AlertsListView {...props} />}</AlertsListContainer>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Title subTitle>Notification Channels</Title>
            <Link href={UrlService.newNotificationChannel()} className={cn(buttonVariants({ variant: "default", size: "sm" }), "space-x-2")}>
              <Plus />
              <span>Create</span>
            </Link>
          </div>
          <NotificationChannelsListContainer>{props => <NotificationChannelsListView {...props} />}</NotificationChannelsListContainer>
        </section>
      </SettingsLayout>
    </Layout>
  );
};
