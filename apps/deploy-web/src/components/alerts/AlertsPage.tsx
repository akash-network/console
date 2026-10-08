import React, { type FC, useState } from "react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { Plus } from "lucide-react";
import { NextSeo } from "next-seo";

import { AlertsListContainer } from "@src/components/alerts/AlertsListContainer/AlertsListContainer";
import { AlertsListView } from "@src/components/alerts/AlertsListView/AlertsListView";
import { NotificationChannelDialog } from "@src/components/alerts/NotificationChannelDialog/NotificationChannelDialog";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListView } from "@src/components/alerts/NotificationChannelsListView/NotificationChannelsListView";
import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";

export const DEPENDENCIES = {
  Layout,
  SettingsLayout,
  AlertsListContainer,
  AlertsListView,
  NotificationChannelsListContainer,
  NotificationChannelsListView,
  NotificationChannelDialog
};

type AlertsTab = "alerts" | "channels";

const TAB_TRIGGER_CLASS_NAME = "rounded-[9px] px-4 py-[7px] text-[13.5px] data-[state=active]:bg-background";

export const AlertsPage: FC<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const [tab, setTab] = useState<AlertsTab>("alerts");
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  return (
    <d.Layout background="dots" disableContainer containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="Alerts" />
      <d.SettingsLayout
        title="Alerts"
        description="Get notified about your deployments and manage where alerts are sent."
        headerActions={
          tab === "channels" && (
            <Button size="sm" className="gap-1.5" onClick={() => setIsAddingChannel(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add channel
            </Button>
          )
        }
      >
        <Tabs value={tab} onValueChange={value => setTab(value as AlertsTab)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="alerts" className={TAB_TRIGGER_CLASS_NAME}>
              Alerts
            </TabsTrigger>
            <TabsTrigger value="channels" className={TAB_TRIGGER_CLASS_NAME}>
              Notification Channels
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-6">
            <d.AlertsListContainer>{props => <d.AlertsListView {...props} />}</d.AlertsListContainer>
          </TabsContent>

          <TabsContent value="channels" className="mt-6">
            <d.NotificationChannelsListContainer>{props => <d.NotificationChannelsListView {...props} />}</d.NotificationChannelsListContainer>
          </TabsContent>
        </Tabs>
      </d.SettingsLayout>

      {isAddingChannel && <d.NotificationChannelDialog onClose={() => setIsAddingChannel(false)} />}
    </d.Layout>
  );
};
