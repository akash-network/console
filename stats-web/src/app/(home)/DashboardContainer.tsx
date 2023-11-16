"use client";
import { GradientText } from "@/components/ui/GradientText";
import Loading from "@/components/ui/Loading";
import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { useDashboardData } from "@/queries/useDashboardData";
import { ReactNode } from "react";
import { Dashboard } from "./Dashboard";

type Props = {
  children?: ReactNode;
};

export const DashboardContainer: React.FunctionComponent<Props> = ({}) => {
  const { data: dashboardData, isLoading } = useDashboardData();
  const selectedNetwork = useSelectedNetwork();

  return (
    <div className="mt-8">
      {isLoading && !dashboardData && (
        <div className="flex justify-center p-4 align-middle">
          <Loading
          //  size={60}
          //  color="secondary"
          />
        </div>
      )}

      {dashboardData && (
        <>
          <div className="text-center">
            <GradientText className="mb-8 text-xl font-bold sm:text-2xl md:text-3xl">Akash Network {selectedNetwork.title} Dashboard</GradientText>
          </div>

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
