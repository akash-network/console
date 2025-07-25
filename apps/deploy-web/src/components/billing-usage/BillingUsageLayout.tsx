"use client";

import type { ReactNode } from "react";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useRouter } from "next/navigation";

import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";

export enum BillingUsageTabs {
  BILLING = "BILLING",
  USAGE = "USAGE"
}

type Props = {
  page: BillingUsageTabs;
  children?: ReactNode;
};

export const BillingUsageLayout: React.FunctionComponent<Props> = ({ children, page }) => {
  const router = useRouter();

  const changeTab = (newValue: string) => {
    switch (newValue as BillingUsageTabs) {
      case BillingUsageTabs.BILLING:
        router.push(UrlService.billing());
        break;
      case BillingUsageTabs.USAGE:
      default:
        router.push(UrlService.usage());
        break;
    }
  };

  return (
    <Tabs value={page} onValueChange={changeTab} className="space-y-4 pb-6">
      <Title>Billing & Usage</Title>

      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value={BillingUsageTabs.BILLING} className={cn({ ["font-bold"]: page === BillingUsageTabs.BILLING })}>
          Billing
        </TabsTrigger>
        <TabsTrigger value={BillingUsageTabs.USAGE} className={cn({ ["font-bold"]: page === BillingUsageTabs.USAGE })}>
          Usage
        </TabsTrigger>
      </TabsList>

      <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
    </Tabs>
  );
};
