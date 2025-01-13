"use client";
import React, { useCallback, useMemo } from "react";
import { Button, Separator, Spinner } from "@akashnetwork/ui/components";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@akashnetwork/ui/components";
import { ShieldCheck, WarningTriangle } from "iconoir-react";
import Link from "next/link";

import { DashboardCardSkeleton } from "@src/components/dashboard/DashboardCardSkeleton";
import { FinanceCard } from "@src/components/dashboard/FinanceCard";
import { ResourceCards } from "@src/components/dashboard/ResourcesCard";
import { Layout } from "@src/components/layout/Layout";
import { ProviderActionList } from "@src/components/shared/ProviderActionList";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useAKTData } from "@src/queries";
import { useProviderActions, useProviderDashboard, useProviderDetails } from "@src/queries/useProviderQuery";
import { formatUUsd } from "@src/utils/formatUsd";

const OfflineWarningBanner: React.FC = () => (
  <div className="mb-4 rounded-md bg-yellow-100 p-4 text-yellow-700">
    <div className="flex">
      <WarningTriangle className="mr-2 h-5 w-5" />
      <p>
        Warning: Your provider is currently offline.{" "}
        <Link href="/remedies" className="font-medium underline">
          Click here for remedies
        </Link>
        .
      </p>
    </div>
  </div>
);

const ProviderStatusIndicators: React.FC<{
  isOnline: boolean;
  isAudited: boolean;
  aktPrice: string | null;
}> = ({ isOnline, isAudited, aktPrice }) => {
  const handleAktPriceClick = useCallback(() => {
    window.open("https://www.coingecko.com/en/coins/akash-network", "_blank");
  }, []);

  return (
    <>
      <div className="flex-end mr-4 text-center md:h-auto">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
            </TooltipTrigger>
            <TooltipContent>
              <p>{isOnline ? "Provider is online" : "Provider is offline"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-end mr-4 text-center md:h-auto">
        <div className={`flex items-center rounded-sm px-3 py-1 ${isAudited ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
          <ShieldCheck className={`mr-1 h-4 w-4 ${isAudited ? "text-green-500" : "text-yellow-500"}`} />
          {isAudited ? "Audited" : "Not Audited"}
        </div>
      </div>
      <div className="flex-end text-center md:h-auto">
        <Button variant="outline" className="md:h-auto" onClick={handleAktPriceClick}>
          {aktPrice === null ? "Loading AKT Price..." : `AKT Current Price: $${aktPrice}`}
        </Button>
      </div>
    </>
  );
};

const Dashboard: React.FC = () => {
  const { data: aktData }: any = useAKTData();
  const { address }: any = useSelectedChain();
  const { isOnline } = useWallet();

  const { data: providerDetails, isLoading: isLoadingProviderDetails }: any = useProviderDetails(address);
  const { data: providerDashboard, isLoading: isLoadingProviderDashboard }: any = useProviderDashboard(address);
  const { data: providerActions, isLoading: isLoadingProviderActions } = useProviderActions();

  const summaryCards = useMemo(
    () => (
      <>
        <FinanceCard
          title={formatUUsd(providerDashboard?.current.dailyUUsdEarned)}
          subtitle="Total Paid 24H"
          currentPrice={providerDashboard?.current.dailyUUsdEarned}
          previousPrice={providerDashboard?.previous.dailyUUsdEarned}
          message="Change in total paid compared to 24 hours ago"
        />
        <FinanceCard
          title={formatUUsd(providerDashboard?.current.totalUUsdEarned)}
          subtitle="Total Paid"
          currentPrice={providerDashboard?.current.totalUUsdEarned}
          previousPrice={providerDashboard?.previous.totalUUsdEarned}
          message="Change in total paid compared to 24 hours ago"
        />
        <FinanceCard
          title={providerDashboard?.current.activeLeaseCount ? `${providerDashboard?.current.activeLeaseCount}` : "0"}
          subtitle="Active Leases"
          currentPrice={providerDashboard?.current.activeLeaseCount}
          previousPrice={providerDashboard?.previous.activeLeaseCount}
          message="Change in active leases compared to 24 hours ago"
        />
        <FinanceCard
          title={providerDashboard?.current.totalLeaseCount ? `${providerDashboard?.current.totalLeaseCount}` : "0"}
          subtitle="Total Leases"
          currentPrice={providerDashboard?.current.totalLeaseCount}
          previousPrice={providerDashboard?.previous.totalLeaseCount}
          message="Change in total leases compared to 24 hours ago"
        />
      </>
    ),
    [providerDashboard]
  );

  return (
    <Layout>
      {providerDetails && !isOnline && <OfflineWarningBanner />}
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Dashboard</Title>
        </div>
        {providerDetails && <ProviderStatusIndicators isOnline={isOnline} isAudited={providerDetails.isAudited} aktPrice={aktData.aktPrice} />}
      </div>
      <div className="mt-10">
        <div className="text-sm font-semibold">
          <div className="inline-flex items-center space-x-2">
            Provider Summary
            {isLoadingProviderDashboard && <Spinner className="mb-2 ml-2 h-5 w-5" />}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-4">
          {isLoadingProviderDashboard ? (
            <>
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
            </>
          ) : (
            summaryCards
          )}
        </div>
      </div>
      <div className="mt-8">
        <div className="text-sm font-semibold">Resources Leased Summary</div>
        <div className="mt-2">
          {isLoadingProviderDetails ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
            </div>
          ) : (
            <ResourceCards providerDetails={providerDetails} />
          )}
        </div>
      </div>

      <Separator className="mt-10" />
      <div className="mt-8">
        <div className="mt-2">
          <div className="text-sm font-semibold">Recent Provider Actions</div>
          {isLoadingProviderActions ? <Spinner className="mt-4" /> : <ProviderActionList actions={providerActions?.slice(0, 5) || []} />}
        </div>
      </div>
    </Layout>
  );
};

export default withAuth(Dashboard);
