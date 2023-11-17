"use client";
import { GradientText } from "@/components/ui/GradientText";
import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { useDashboardData } from "@/queries/useDashboardData";
import { ReactNode } from "react";
import { Dashboard } from "./Dashboard";
import Spinner from "@/components/ui/Spinner";
import { Title } from "@/components/ui/Title";

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
          <Title className="mb-8 text-xl font-bold sm:text-2xl md:text-3xl">Akash Network {selectedNetwork.title} Dashboard</Title>

          <Dashboard dashboardData={dashboardData} />

          {/* <div
            sx={{
              mt: 5,
              [theme.breakpoints.down("md")]: {
                textAlign: "center"
              }
            }}
          >
            <Typography variant="caption" sx={{ fontStyle: "italic", color: theme.palette.grey[500] }}>
              Last updated: <FormattedDate value={dashboardData.now.date} /> <FormattedTime value={dashboardData.now.date} />
            </Typography>
          </div> */}
        </>
      )}
    </div>
  );
};
