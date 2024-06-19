"use client";
import React, { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";

import { ErrorFallback } from "@src/components/shared/ErrorFallback";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";
import { Title } from "../shared/Title";

export enum SettingsTabs {
  GENERAL = "GENERAL",
  AUTHORIZATIONS = "AUTHORIZATIONS"
}

type Props = {
  page: SettingsTabs;
  children?: ReactNode;
  title: string;
  headerActions?: ReactNode;
};

export const SettingsLayout: React.FunctionComponent<Props> = ({ children, page, title, headerActions }) => {
  const router = useRouter();

  const handleTabChange = (newValue: SettingsTabs) => {
    switch (newValue) {
      case SettingsTabs.AUTHORIZATIONS:
        router.push(UrlService.settingsAuthorizations());
        break;
      case SettingsTabs.GENERAL:
      default:
        router.push(UrlService.settings());
        break;
    }
  };

  return (
    <Tabs value={page} onValueChange={handleTabChange}>
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value={SettingsTabs.GENERAL} className={cn({ ["font-bold"]: page === SettingsTabs.GENERAL })}>
          General
        </TabsTrigger>
        <TabsTrigger value={SettingsTabs.AUTHORIZATIONS} className={cn({ ["font-bold"]: page === SettingsTabs.AUTHORIZATIONS })}>
          Authorizations
        </TabsTrigger>
      </TabsList>

      <div className="mt-4 flex flex-wrap items-center py-4">
        <Title>{title}</Title>
        {headerActions}
      </div>

      <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
    </Tabs>
  );
};
