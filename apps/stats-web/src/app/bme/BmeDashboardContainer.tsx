"use client";
import { FormattedDate, FormattedTime } from "react-intl";
import { Spinner } from "@akashnetwork/ui/components";

import { BmeDashboard } from "./BmeDashboard";

import { Title } from "@/components/Title";
import { useBmeDashboardData, useBmeStatusHistory } from "@/queries";

export const BmeDashboardContainer: React.FunctionComponent = () => {
  const { data: dashboardData, isLoading: isLoadingDashboard } = useBmeDashboardData();
  const { data: statusHistory, isLoading: isLoadingStatusHistory } = useBmeStatusHistory();

  const isLoading = isLoadingDashboard || isLoadingStatusHistory;
  const hasData = dashboardData?.now && dashboardData?.compare;

  return (
    <div className="mt-8">
      {hasData && (
        <>
          <Title className="mb-4 text-2xl font-semibold">BME Dashboard</Title>

          <div className="mb-8">
            <p className="text-italic text-sm italic text-muted-foreground">
              Last updated: {!!dashboardData?.now?.date && <FormattedDate value={dashboardData.now.date} />}{" "}
              {!!dashboardData?.now?.date && <FormattedTime value={dashboardData.now.date} />}
            </p>
          </div>

          <BmeDashboard dashboardData={dashboardData} statusHistory={statusHistory ?? []} />
        </>
      )}

      {isLoading && !hasData && (
        <div className="flex items-center justify-center p-4">
          <Spinner size="large" />
        </div>
      )}
    </div>
  );
};
