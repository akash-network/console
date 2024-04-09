"use client";
import React, { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { UrlService } from "@src/utils/urlUtils";
import { useRouter } from "next/navigation";
import { ErrorFallback } from "@src/components/shared/ErrorFallback";
import { Tabs, TabsList, TabsTrigger } from "@src/components/ui/tabs";
import { cn } from "@src/utils/styleUtils";

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

      <div className="flex flex-wrap items-center pb-2 pt-8 mb-4">
        <h1 className="text-3xl font-bold">{title}</h1>
        {headerActions}
      </div>

      <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
    </Tabs>
  );
};
