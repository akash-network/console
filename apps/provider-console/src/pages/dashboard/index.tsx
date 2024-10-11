"use client";
import React, { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { Button, Card, CardContent, CardHeader, Separator } from "@akashnetwork/ui/components";
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

const Dashboard: React.FC = () => {
  const [providerActions, setProviderActions] = useState<any[]>([]);
  const [aktPrice, setAktPrice] = useState<string | null>(null);
  const { address } = useSelectedChain();

  // Add this query to fetch provider details
  const { data: providerDetails, isLoading: isLoadingProviderDetails }: { data: any; isLoading: boolean } = useQuery(
    "providerDetails",
    () => consoleClient.get(`/providers/${address}`),
    {
      // You might want to adjust these options based on your needs
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
      {providerDetails && !providerDetails.isOnline && (
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
                  <div className={`h-2 w-2 rounded-full ${providerDetails.isOnline ? "bg-green-500" : "bg-red-500"}`} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{providerDetails.isOnline ? "Provider is online" : "Provider is offline"}</p>
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
        <div className="text-sm">Provider Summary</div>
        <div className="mt-2 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="rounded-lg p-6 shadow-md">
              <div className="grid grid-cols-3 gap-4">
                <div className="">
                  <div className="text-sm font-medium">Total Paid 24H</div>
                  <div className="text-2xl font-semibold">$2555.0</div>
                  <div className="mt-1 text-sm font-medium text-green-500">+3.35%</div>
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  <div className="w-full overflow-hidden">
                    <StatLineCharts data={[15, 0, 25, 0, 45, 70]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="rounded-lg p-6 shadow-md">
              <div className="grid grid-cols-3 gap-4">
                <div className="">
                  <div className="text-sm font-medium">Total Paid 7D</div>
                  <div className="text-2xl font-semibold">$7354.0</div>
                  <div className="mt-1 text-sm font-medium">+7.35%</div>
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  <div className="w-full overflow-hidden">
                    <StatLineCharts data={[25, 65, 30, 45, 80]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="rounded-lg p-6 shadow-md">
              <div className="grid grid-cols-3 gap-4">
                <div className="">
                  <div className="text-sm font-medium">Total Leases</div>
                  <div className="text-2xl font-semibold">18</div>
                  <div className="mt-1 text-sm font-medium">+5.70%</div>
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  <div className="w-full overflow-hidden">
                    <StatLineCharts data={[10, 34, 20, 60, 75]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {providerDetails && providerDetails.isOnline && (
        <>
          <div className="mt-8">
            <div className="text-sm">Resources Leased Summary</div>
            <div className="mt-2">{isLoadingProviderDetails ? <div>Loading resource details...</div> : renderResourceCards(providerDetails)}</div>
          </div>
        </>
      )}
      <div className="mt-8">
        <div className="text-sm">Spent Assets Summary</div>
        <div className="mt-2 grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <div className="text-sm">AKT Spent</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">$2555.0</div>
                  <div className="text-sm">3.35%</div>
                </div>
                <div className="">Graph here</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>Total Paid</CardHeader>
            <CardContent className="pb-4 pt-0">$2555.0</CardContent>
          </Card>
          <Card>
            <CardHeader>Total Paid</CardHeader>
            <CardContent className="pb-4 pt-0">$2555.0</CardContent>
          </Card>
        </div>
        <Separator className="my-4" />
        <div className="mt-2">
          <div className="text-sm">Provider Activity</div>
          <ProviderActionList actions={providerActions} />
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
      data: getResourceData(providerDetails?.activeStats?.cpu / 1000, providerDetails?.pendingStats?.cpu / 1000, providerDetails?.availableStats?.cpu / 1000)
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
