"use client";
import { Spinner } from "@akashnetwork/ui/components";

import { BmeDashboard } from "./BmeDashboard";

import { Title } from "@/components/Title";
import { useBmeDashboardData, useBmeStatusHistory } from "@/queries";

export const BmeDashboardContainer: React.FunctionComponent = () => {
  const { data: dashboardData, isLoading: isLoadingDashboard } = useBmeDashboardData();
  const { data: statusHistory, isLoading: isLoadingStatusHistory } = useBmeStatusHistory();

  const isLoading = isLoadingDashboard || isLoadingStatusHistory;

  return (
    <div className="mt-8">
      {dashboardData && (
        <>
          <Title className="mb-8 text-2xl font-semibold">BME Dashboard</Title>
          <BmeDashboard dashboardData={dashboardData} statusHistory={statusHistory ?? []} />
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
