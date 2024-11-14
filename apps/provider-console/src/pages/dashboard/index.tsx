"use client";
import React, { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { Button, Card, CardContent, CardHeader, Separator, Spinner } from "@akashnetwork/ui/components";
import consoleClient from "@src/utils/consoleClient";
import { Shield, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@akashnetwork/ui/components";
import Link from "next/link";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import restClient from "@src/utils/restClient";
import ProviderActionList from "@src/components/shared/ProviderActionList";
import { StatLineCharts } from "@src/components/dashboard/stat-line-charts";
import { StatPieChart } from "@src/components/dashboard/stat-pie-charts";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { formatBytes } from "@src/utils/formatBytes";
import withAuth from "@src/components/shared/withAuth";
import { formatUUsd } from "@src/utils/formatUsd";
import DashboardCardSkeleton from "@src/components/dashboard/DashboardCardSkeleton";
import { useWallet } from "@src/context/WalletProvider";

// Moved outside component to avoid recreation on each render
const fetchAktPrice = async () => {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/coins/akash-network/tickers");
    const data = await response.json();
    const coinbasePrice = data.tickers.find((ticker: any) => ticker.market.name === "Coinbase Exchange");
    return coinbasePrice ? coinbasePrice.converted_last.usd.toFixed(2) : "N/A";
  } catch (error) {
    console.error("Error fetching AKT price:", error);
    return "N/A";
  }
};

const calculatePercentageChange = (currentPrice: number | null, previousPrice: number | null) => {
  if (currentPrice === null || previousPrice === null || previousPrice === 0) {
    return <span className="text-gray-500">0%</span>;
  }

  const percentageChange = ((currentPrice - previousPrice) / previousPrice) * 100;
  const formattedChange = Math.abs(percentageChange).toFixed(2);

  if (percentageChange > 0) {
    return <span className="text-green-500">+{formattedChange}%</span>;
  } else if (percentageChange < 0) {
    return <span className="text-red-500">-{formattedChange}%</span>;
  } else {
    return <span className="text-gray-500">0%</span>;
  }
};

const Dashboard: React.FC = () => {
  const [providerActions, setProviderActions] = useState<any[]>([]);
  const [aktPrice, setAktPrice] = useState<string | null>(null);
  const { address } = useSelectedChain();
  const { isOnline } = useWallet();

  // Add this query to fetch provider details
  const { data: providerDetails, isLoading: isLoadingProviderDetails }: { data: any; isLoading: boolean } = useQuery(
    "providerDetails",
    () => consoleClient.get(`/v1/providers/${address}`),
    {
      // You might want to adjust these options based on your needs
      refetchOnWindowFocus: false,
      retry: 3
    }
  );

  // Add this new query to fetch provider dashboard details
  const { data: providerDashboard, isLoading: isLoadingProviderDashboard }: { data: any; isLoading: boolean } = useQuery(
    "providerDashboard",
    () => consoleClient.get(`/internal/provider-dashboard/${address}`),
    {
      refetchOnWindowFocus: false,
      retry: 3
    }
  );

  useEffect(() => {
    const fetchData = async () => {
      const [price, actions]: [string, any] = await Promise.all([fetchAktPrice(), restClient.get("/actions")]);
      setAktPrice(price);
      setProviderActions(actions.actions);
    };

    fetchData();
  }, []);

  return (
    <Layout>
      {providerDetails && !isOnline && (
        <div className="mb-4 rounded-md bg-yellow-100 p-4 text-yellow-700">
          <div className="flex">
            <AlertTriangle className="mr-2 h-5 w-5" />
            <p>
              Warning: Your provider is currently offline.{" "}
              <Link href="/remedies" className="font-medium underline">
                Click here for remedies
              </Link>
              .
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Dashboard</Title>
        </div>
        <div className="flex-end mr-4 text-center md:h-auto">
          {providerDetails && (
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
          )}
        </div>
        <div className="flex-end mr-4 text-center md:h-auto">
          {providerDetails && (
            <div
              className={`flex items-center rounded-sm px-3 py-1 ${providerDetails.isAudited ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
            >
              <Shield className={`mr-1 h-4 w-4 ${providerDetails.isAudited ? "text-green-500" : "text-yellow-500"}`} />
              {providerDetails.isAudited ? "Audited" : "Not Audited"}
            </div>
          )}
        </div>
        <div className="flex-end text-center md:h-auto">
          <Button variant="outline" className="md:h-auto" onClick={() => window.open("https://www.coingecko.com/en/coins/akash-network", "_blank")}>
            {aktPrice === null ? "Loading AKT Price..." : `AKT Current Price: $${aktPrice}`}
          </Button>
        </div>
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
            <>
              <Card>
                <CardContent className="rounded-lg p-6 shadow-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="">
                      <div className="text-sm font-medium">Total Paid 24H</div>
                      <div className="text-2xl font-semibold">{formatUUsd(providerDashboard?.current.dailyUUsdEarned)}</div>
                      <div className="mt-1 text-sm font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {calculatePercentageChange(providerDashboard?.current.dailyUUsdEarned, providerDashboard?.previous.dailyUUsdEarned)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Change in total paid compared to 24 hours ago</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <div className="w-full overflow-hidden">
                        {/* <StatLineCharts data={[15, 0, 25, 0, 45, 70]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} /> */}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="rounded-lg p-6 shadow-md">
                  <div className="grid-cols4 grid gap-4">
                    <div className="">
                      <div className="text-sm font-medium">Total Paid</div>
                      <div className="text-2xl font-semibold">{formatUUsd(providerDashboard?.current.totalUUsdEarned)}</div>
                      <div className="mt-1 text-sm font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {calculatePercentageChange(providerDashboard?.current.totalUUsdEarned, providerDashboard?.previous.totalUUsdEarned)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Change in total paid compared to 24 hours ago</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <div className="w-full overflow-hidden">
                        {/* <StatLineCharts data={[25, 65, 30, 45, 80]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} /> */}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="rounded-lg p-6 shadow-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="">
                      <div className="text-sm font-medium">Active Leases</div>
                      <div className="text-2xl font-semibold">
                        {providerDashboard?.current.activeLeaseCount ? `${providerDashboard?.current.activeLeaseCount}` : "0"}
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {calculatePercentageChange(providerDashboard?.current.activeLeaseCount, providerDashboard?.previous.activeLeaseCount)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Change in active leases compared to 24 hours ago</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <div className="w-full overflow-hidden">
                        {/* <StatLineCharts data={[10, 34, 20, 60, 75]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} /> */}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="rounded-lg p-6 shadow-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="">
                      <div className="text-sm font-medium">Total Leases</div>
                      <div className="text-2xl font-semibold">
                        {providerDashboard?.current.totalLeaseCount ? `${providerDashboard?.current.totalLeaseCount}` : "0"}
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {calculatePercentageChange(providerDashboard?.current.totalLeaseCount, providerDashboard?.previous.totalLeaseCount)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Change in total leases compared to 24 hours ago</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <div className="w-full overflow-hidden">
                        {/* <StatLineCharts data={[10, 34, 20, 60, 75]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} /> */}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
      {isOnline && (
        <>
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
                renderResourceCards(providerDetails)
              )}
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
          <ProviderActionList actions={providerActions.slice(0, 5)} />
        </div>
      </div>
    </Layout>
  );
};

// Updated ResourceCard component
const ResourceCard: React.FC<{
  title: string;
  active: number | string;
  activePercentage: number;
  pending: number | string;
  pendingPercentage: number;
  available: number | string;
  availablePercentage: number;
  total: number | string;
}> = ({ title, active, activePercentage, pending, pendingPercentage, available, availablePercentage, total }) => (
  <Card>
    <CardHeader>
      <div className="text-sm">{title}</div>
    </CardHeader>
    <CardContent className="pb-4 pt-0">
      <div className="grid grid-cols-3 gap-2">
        <div className="">
          <div className="whitespace-nowrap text-lg font-bold">{active}</div>
          <div className="whitespace-nowrap text-xs text-gray-500">/{total}</div>
        </div>
        <div className="col-span-2 flex items-center justify-end">
          <div className="w-full overflow-hidden">
            <StatPieChart activeResources={activePercentage} pendingResources={pendingPercentage} availableResources={availablePercentage} />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Updated getResourceData function
const getResourceData = (active: number = 0, pending: number = 0, available: number = 0, isBytes: boolean = false) => {
  const total = active + pending + available;
  if (total === 0) return null;

  const activePercentage = (active / total) * 100;
  const pendingPercentage = (pending / total) * 100;
  const availablePercentage = (available / total) * 100;

  return {
    active: isBytes ? formatBytes(active) : active,
    activePercentage,
    pending: isBytes ? formatBytes(pending) : pending,
    pendingPercentage,
    available: isBytes ? formatBytes(available) : available,
    availablePercentage,
    total: isBytes ? formatBytes(total) : total
  };
};

// New function to render resource cards
const renderResourceCards = (providerDetails: any) => {
  const resources = [
    {
      title: "CPUs",
      data: providerDetails?.activeStats?.cpu || providerDetails?.pendingStats?.cpu || providerDetails?.availableStats?.cpu
        ? getResourceData(
            (providerDetails?.activeStats?.cpu ?? 0) / 1000,
            (providerDetails?.pendingStats?.cpu ?? 0) / 1000,
            (providerDetails?.availableStats?.cpu ?? 0) / 1000
          )
        : null
    },
    { title: "GPUs", data: getResourceData(providerDetails?.activeStats?.gpu, providerDetails?.pendingStats?.gpu, providerDetails?.availableStats?.gpu) },
    {
      title: "Memory",
      data: getResourceData(providerDetails?.activeStats?.memory, providerDetails?.pendingStats?.memory, providerDetails?.availableStats?.memory, true)
    },
    {
      title: "Storage",
      data: getResourceData(providerDetails?.activeStats?.storage, providerDetails?.pendingStats?.storage, providerDetails?.availableStats?.storage, true)
    }
  ];

  const validResources = resources.filter(resource => resource.data !== null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {validResources.map(({ title, data }: { title: string; data: any }) => (
        <ResourceCard
          key={title}
          title={title}
          active={data.active ?? 0}
          activePercentage={data.activePercentage ?? 0}
          pending={data.pending ?? 0}
          pendingPercentage={data.pendingPercentage ?? 0}
          available={data.available ?? 0}
          availablePercentage={data.availablePercentage ?? 0}
          total={data.total ?? 0}
        />
      ))}
    </div>
  );
};

export default withAuth(Dashboard);
