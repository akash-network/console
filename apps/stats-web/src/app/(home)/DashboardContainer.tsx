"use client";
import { FormattedDate, FormattedTime } from "react-intl";

import { Dashboard } from "./Dashboard";

import Spinner from "@/components/Spinner";
import { Title } from "@/components/Title";
import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { useMarketData } from "@/queries";
import { useDashboardData } from "@/queries/useDashboardData";

export const DashboardContainer: React.FunctionComponent = () => {
  const { data: dashboardData, isLoading: isLoadingDashboardData } = useDashboardData();
  const { data: marketData, isLoading: isLoadingMarketData } = useMarketData();
  const selectedNetwork = useSelectedNetwork();
  const isLoading = isLoadingMarketData || isLoadingDashboardData;

  return (
    <div className="mt-8">
      {dashboardData && marketData && (
        <>
          <Title className="mb-4 text-xl font-bold sm:text-2xl md:text-3xl">Akash Network {selectedNetwork.title} Dashboard</Title>

          <div className="mb-8">
            <p className="text-italic text-muted-foreground text-sm italic">
              Last updated: <FormattedDate value={dashboardData.now.date} /> <FormattedTime value={dashboardData.now.date} />
            </p>
          </div>

          <Dashboard dashboardData={dashboardData} marketData={marketData} />
        </>
      )}

      {isLoading && !dashboardData && (
        <div className="flex items-center justify-center p-4">
          <Spinner size="large" />
        </div>
      )}
    </div>
  );
};
