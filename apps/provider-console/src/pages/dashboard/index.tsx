"use client";
import React, { useMemo } from "react";
import { Separator, Spinner } from "@akashnetwork/ui/components";
import { WarningTriangle } from "iconoir-react";
import Link from "next/link";

import { DashboardCardSkeleton } from "@src/components/dashboard/DashboardCardSkeleton";
import { FinanceCard } from "@src/components/dashboard/FinanceCard";
import { ResourceCards } from "@src/components/dashboard/ResourcesCard";
import { Layout } from "@src/components/layout/Layout";
import { ActivityLogList } from "@src/components/shared/ActivityLogList";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
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

const Dashboard: React.FC = () => {
  const { address } = useSelectedChain();
  const { isOnline, isProviderOnlineStatusFetched } = useWallet();

  const { data: providerDetails, isLoading: isLoadingProviderDetails } = useProviderDetails(address);
  const { data: providerDashboard, isLoading: isLoadingProviderDashboard } = useProviderDashboard(address);
  const { data: providerActions, isLoading: isLoadingProviderActions } = useProviderActions();

  const summaryCards = useMemo(
    () => (
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <FinanceCard
          title={formatUUsd(providerDashboard?.current.dailyUUsdEarned)}
          subtitle="Earned (last 24H)"
          currentPrice={providerDashboard?.current.dailyUUsdEarned ?? null}
          previousPrice={providerDashboard?.previous.dailyUUsdEarned ?? null}
          message="Change in earned paid compared to 24 hours ago"
        />
        <FinanceCard
          title={formatUUsd(providerDashboard?.current.totalUUsdEarned)}
          subtitle="Earned (Total)"
          currentPrice={providerDashboard?.current.totalUUsdEarned ?? null}
          previousPrice={providerDashboard?.previous.totalUUsdEarned ?? null}
          message="Change in total earned compared to 24 hours ago"
        />
        <FinanceCard
          title={providerDashboard?.current.activeLeaseCount ? `${providerDashboard?.current.activeLeaseCount}` : "0"}
          subtitle="Active Leases"
          currentPrice={providerDashboard?.current.activeLeaseCount ?? null}
          previousPrice={providerDashboard?.previous.activeLeaseCount ?? null }
          message="Change in active leases compared to 24 hours ago"
        />
        <FinanceCard
          title={providerDashboard?.current.totalLeaseCount ? `${providerDashboard?.current.totalLeaseCount}` : "0"}
          subtitle="Total Leases"
          currentPrice={providerDashboard?.current.totalLeaseCount ?? null}
          previousPrice={providerDashboard?.previous.totalLeaseCount ?? null}
          message="Change in total leases compared to 24 hours ago"
        />
      </div>
    ),
    [providerDashboard]
  );

  return (
    <Layout isLoading={!isProviderOnlineStatusFetched}>
      {providerDetails && !isOnline && <OfflineWarningBanner />}
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Dashboard</Title>
        </div>
      </div>
      <div className="mt-10">
        <div className="text-lg font-semibold">
          <div className="inline-flex items-center space-x-2">
            Earnings and Leases
            {isLoadingProviderDashboard && <Spinner className="mb-2 ml-2 h-5 w-5" />}
          </div>
        </div>
        <div className="mt-2">
          {isLoadingProviderDashboard ? (
            <div className="grid grid-cols-3 gap-4">
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
              <DashboardCardSkeleton />
            </div>
          ) : (
            summaryCards
          )}
        </div>
      </div>
      <div className="mt-8">
        <div className="text-lg font-semibold">Resources</div>
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
          <div className="text-lg font-semibold">Activity Logs</div>
          {isLoadingProviderActions ? <Spinner className="mt-4" /> : <ActivityLogList actions={providerActions?.slice(0, 5) || []} />}
        </div>
      </div>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: Dashboard, authLevel: "provider" });
