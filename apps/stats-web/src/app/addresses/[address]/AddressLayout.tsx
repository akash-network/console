"use client";
import type { ReactNode } from "react";
import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { useRouter } from "next-nprogress-bar";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { UrlService } from "@/lib/urlUtils";

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
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>

        {children}
      </Tabs>
    </PageContainer>
  );
}
