"use client";

import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { useDashboardData } from "@/queries/useDashboardData";
import { ReactNode } from "react";
import { Dashboard } from "./Dashboard";
import Spinner from "@/components/Spinner";
import { Title } from "@/components/Title";
import { FormattedDate, FormattedTime } from "react-intl";

type Props = {
  children?: ReactNode;
};

export const DashboardContainer: React.FunctionComponent<Props> = ({}) => {
  const { data: dashboardData, isLoading } = useDashboardData();
  const selectedNetwork = useSelectedNetwork();

  return (
    <div className="mt-8">
      {isLoading && !dashboardData && (
        <div className="flex items-center justify-center p-4">
          <Spinner />
        </div>
      )}

      {dashboardData && (
        <>
          <Title className="mb-4 text-xl font-bold sm:text-2xl md:text-3xl">Akash Network {selectedNetwork.title} Dashboard</Title>

          <div className="mb-8">
            <p className="text-sm text-italic italic text-muted-foreground">
              Last updated: <FormattedDate value={dashboardData.now.date} /> <FormattedTime value={dashboardData.now.date} />
            </p>
          </div>

          <Dashboard dashboardData={dashboardData} />
        </>
      )}
    </div>
  );
};
