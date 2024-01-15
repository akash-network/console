"use client";
import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { useDashboardData } from "@/queries/useDashboardData";
import { ReactNode } from "react";
import { Dashboard } from "./Dashboard";
import Spinner from "@/components/Spinner";
import { Title } from "@/components/Title";
import { FormattedDate, FormattedTime } from "react-intl";
import { useMarketData } from "@/queries";

type Props = {
  children?: ReactNode;
};

export const DashboardContainer: React.FunctionComponent<Props> = ({}) => {
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
            <p className="text-italic text-sm italic text-muted-foreground">
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
