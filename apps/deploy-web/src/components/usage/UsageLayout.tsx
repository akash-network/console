"use client";

import type { ReactNode } from "react";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useRouter } from "next/navigation";

import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";

export enum UsageTabs {
  BILLING = "BILLING",
  USAGE = "USAGE"
}

type Props = {
  page: UsageTabs;
  children?: ReactNode;
};

export const UsageLayout: React.FunctionComponent<Props> = ({ children, page }) => {
  const router = useRouter();

  const handleTabChange = (newValue: string) => {
    switch (newValue as UsageTabs) {
      case UsageTabs.BILLING:
        router.push(UrlService.billing());
        break;
      case UsageTabs.USAGE:
      default:
        router.push(UrlService.usage());
        break;
    }
  };

  return (
    <Tabs value={page} onValueChange={handleTabChange} className="pb-6">
      <Title className="mb-4">Billing & Usage</Title>

      <TabsList className="mb-4 grid w-full grid-cols-2">
        <TabsTrigger value={UsageTabs.BILLING} className={cn({ ["font-bold"]: page === UsageTabs.BILLING })}>
          Billing
        </TabsTrigger>
        <TabsTrigger value={UsageTabs.USAGE} className={cn({ ["font-bold"]: page === UsageTabs.USAGE })}>
          Usage
        </TabsTrigger>
      </TabsList>

      <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
    </Tabs>
  );
};
