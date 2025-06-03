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
  CONTACT_POINTS = "CONTACT_POINTS"
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
      case AlertTabs.CONTACT_POINTS:
      default:
        router.push(UrlService.contactPoints());
        break;
    }
  };

  return (
    <Tabs value={page} onValueChange={handleTabChange}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value={AlertTabs.ALERTS} className={cn({ ["font-bold"]: page === AlertTabs.ALERTS })}>
          Alerts
        </TabsTrigger>
        <TabsTrigger value={AlertTabs.CONTACT_POINTS} className={cn({ ["font-bold"]: page === AlertTabs.CONTACT_POINTS })}>
          Contact Points
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
