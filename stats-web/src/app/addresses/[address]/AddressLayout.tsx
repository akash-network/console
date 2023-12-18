"use client";
import React, { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { UrlService } from "@/lib/urlUtils";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { event } from "nextjs-google-analytics";
// import { AnalyticsEvents } from "@src/utils/analytics";

type AddressTab = "address" | "transactions" | "deployments";
type Props = {
  address: string;
  children?: ReactNode;
  page: AddressTab;
};

export default function AddressLayout({ children, page, address }: Props) {
  const router = useRouter();

  const handleTabChange = (newValue: string) => {
    switch (newValue) {
      case "transactions":
        router.push(UrlService.addressTransactions(address));
        break;
      case "deployments":
        router.push(UrlService.addressDeployments(address));
        break;
      case "address":
      default:
        router.push(UrlService.address(address));
        break;
    }
  };

  return (
    <PageContainer>
      <Title className="mb-4">Account Detail</Title>

      <Tabs value={page} onValueChange={handleTabChange}>
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger
            value="address"
            onClick={() => {
              // event(AnalyticsEvents.ADDRESSES_ADDRESS_TAB, {
              //   category: "addresses",
              //   label: "Click on address tab"
              // });
            }}
          >
            Address
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            // onClick={() => {
            //   event(AnalyticsEvents.ADDRESSES_TRANSACTIONS_TAB, {
            //     category: "addresses",
            //     label: "Click on transactions tab"
            //   });
            // }}
          >
            Transactions
          </TabsTrigger>
          <TabsTrigger
            value="deployments"
            // onClick={() => {
            //   event(AnalyticsEvents.ADDRESSES_DEPLOYMENTS_TAB, {
            //     category: "addresses",
            //     label: "Click on deployments tab"
            //   });
            // }}
          >
            Deployments
          </TabsTrigger>
        </TabsList>

        {children}
      </Tabs>
    </PageContainer>
  );
}
