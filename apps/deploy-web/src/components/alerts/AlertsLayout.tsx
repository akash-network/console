"use client";
import type { ReactNode } from "react";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { UrlService } from "@src/utils/urlUtils";
import { Title } from "../shared/Title";

export enum AlertTabs {
  ALERTS = "ALERTS",
  NOTIFICATION_CHANNELS = "NOTIFICATION_CHANNELS"
}

type Props = {
  page: AlertTabs;
  children?: ReactNode;
  title: string;
  headerActions?: ReactNode;
  returnable?: boolean;
};

export const AlertsLayout: React.FunctionComponent<Props> = ({ children, page, title, headerActions, returnable }) => {
  const router = useRouter();

  const handleTabChange = (newValue: string) => {
    switch (newValue as AlertTabs) {
      case AlertTabs.ALERTS:
        router.push(UrlService.alerts());
        break;
      case AlertTabs.NOTIFICATION_CHANNELS:
      default:
        router.push(UrlService.notificationChannels());
        break;
    }
  };

  return (
    <Tabs value={page} onValueChange={handleTabChange} className="pb-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value={AlertTabs.ALERTS} className={cn({ ["font-bold"]: page === AlertTabs.ALERTS })}>
          Alerts
        </TabsTrigger>
        <TabsTrigger value={AlertTabs.NOTIFICATION_CHANNELS} className={cn({ ["font-bold"]: page === AlertTabs.NOTIFICATION_CHANNELS })}>
          Notification Channels
        </TabsTrigger>
      </TabsList>

      <div className="mt-4 flex flex-wrap items-center py-4">
        {returnable && (
          <Link href="." type="button" className="p-2">
            <NavArrowLeft />
          </Link>
        )}
        <Title>{title}</Title>
        {headerActions}
      </div>

      <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
    </Tabs>
  );
};
