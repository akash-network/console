import React from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { AlertsLayout, AlertTabs } from "@src/components/alerts/AlertsLayout";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListView } from "@src/components/alerts/NotificationChannelsListView/NotificationChannelsListView";
import Layout from "@src/components/layout/Layout";

export const NotificationChannelsPage: React.FunctionComponent = () => {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Alerts" />
      <AlertsLayout
        page={AlertTabs.NOTIFICATION_CHANNELS}
        title="Notification Channels"
        headerActions={
          <div className="md:ml-6">
            <Link
              href="notification-channels/new"
              color="secondary"
              type="button"
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "space-x-2")}
            >
              <Plus />
              <span>Create</span>
            </Link>
          </div>
        }
      >
        <NotificationChannelsListContainer>{props => <NotificationChannelsListView {...props} />}</NotificationChannelsListContainer>
      </AlertsLayout>
    </Layout>
  );
};
