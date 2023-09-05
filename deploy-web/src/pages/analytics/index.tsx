import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { ReactNode } from "react";
import PageContainer from "@src/components/shared/PageContainer";
import { useDashboardData } from "@src/queries/useDashboardData";
import { Dashboard } from "@src/components/dashboard/Dashboard";
import { FormattedDate, FormattedTime } from "react-intl";
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from "@mui/material";
import Layout from "@src/components/layout/Layout";
import { useSelectedNetwork } from "@src/utils/networks";
import { GradientText } from "@src/components/shared/GradientText";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  children?: ReactNode;
};

const DashboardPage: React.FunctionComponent<Props> = ({}) => {
  const { data: dashboardData, isLoading } = useDashboardData();
  const theme = useTheme();
  const selectedNetwork = useSelectedNetwork();

  return (
    <Layout isUsingSettings={false} isUsingWallet={false}>
      <CustomNextSeo
        title="Analytics"
        url={`https://deploy.cloudmos.io${UrlService.analytics()}`}
        description="Akash Network's #1 analytics hub. Explore the number of $AKT spent, the network capacity (CPU, GPU, RAM, DISK), historical data and much more!"
      />

      <PageContainer>
        <Box sx={{ marginTop: "2rem" }}>
          {isLoading && !dashboardData && (
            <Box sx={{ display: "flex", alignItems: "center", padding: "1rem", justifyContent: "center" }}>
              <CircularProgress size={60} color="secondary" />
            </Box>
          )}

          {dashboardData && (
            <>
              <Box sx={{ textAlign: "center" }}>
                <GradientText sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem", md: "2rem" }, marginBottom: "2rem", fontWeight: "bold" }}>
                  Akash Network {selectedNetwork.title} Dashboard
                </GradientText>
              </Box>

              <Dashboard dashboardData={dashboardData} />

              <Box
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
              </Box>
            </>
          )}
        </Box>
      </PageContainer>
    </Layout>
  );
};

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}

export default DashboardPage;
