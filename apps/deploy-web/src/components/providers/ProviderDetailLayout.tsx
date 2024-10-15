"use client";
import React, { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button, buttonVariants, ErrorFallback, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { NavArrowLeft, Refresh } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useWallet } from "@src/context/WalletProvider";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { ClientProviderDetailWithStatus } from "@src/types/provider";
import { cn } from "@akashnetwork/ui/utils";
import { UrlService } from "@src/utils/urlUtils";
import { Title } from "../shared/Title";
import { ProviderSummary } from "./ProviderSummary";

export enum ProviderDetailTabs {
  DETAIL = "1",
  LEASES = "2",
  RAW = "3"
}

type Props = {
  page: ProviderDetailTabs;
  provider: Partial<ClientProviderDetailWithStatus>;
  address: string;
  refresh: () => void;
  children?: ReactNode;
};

const ProviderDetailLayout: React.FunctionComponent<Props> = ({ children, page, address, provider, refresh }) => {
  const router = useRouter();
  const { address: walletAddress } = useWallet();
  const previousRoute = usePreviousRoute();

  const handleTabChange = (newValue: ProviderDetailTabs) => {
    switch (newValue) {
      case ProviderDetailTabs.LEASES:
        router.push(UrlService.providerDetailLeases(address));
        break;
      case ProviderDetailTabs.RAW:
        router.push(UrlService.providerDetailRaw(address));
        break;
      case ProviderDetailTabs.DETAIL:
      default:
        router.push(UrlService.providerDetail(address));
        break;
    }
  };

  function handleBackClick() {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.providers());
    }
  }

  return (
    <div className="pb-12">
      <div className="mb-2 flex items-center">
        <Button aria-label="back" onClick={handleBackClick} size="sm" variant="ghost" className="rounded-full">
          <NavArrowLeft />
        </Button>
        <Title className="ml-2 text-2xl">Provider detail</Title>

        <div className="ml-4">
          <Button aria-label="back" onClick={() => refresh()} size="sm" className="rounded-full" variant="ghost">
            <Refresh />
          </Button>
        </div>

        {provider && walletAddress === address && (
          <div className="ml-4">
            <Link href={UrlService.providerDetailEdit(provider.owner as string)} className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
              Edit
            </Link>
          </div>
        )}
      </div>

      {provider && (
        <>
          <ProviderSummary provider={provider as ClientProviderDetailWithStatus} />

          <Tabs value={page} onValueChange={handleTabChange}>
            <TabsList className="mb-4 grid w-full grid-cols-3 rounded-t-none">
              <TabsTrigger value={ProviderDetailTabs.DETAIL}>Detail</TabsTrigger>
              <TabsTrigger value={ProviderDetailTabs.LEASES}>My Leases</TabsTrigger>
              <TabsTrigger value={ProviderDetailTabs.RAW}>Raw Data</TabsTrigger>
            </TabsList>

            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <div className="pt-8">{children}</div>
            </ErrorBoundary>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default ProviderDetailLayout;
