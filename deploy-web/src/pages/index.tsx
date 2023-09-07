import Layout from "../components/layout/Layout";
import { ReactNode, useEffect, useState } from "react";
import React from "react";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useBalances } from "@src/queries/useBalancesQuery";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { YourAccount } from "@src/components/home/YourAccount";
import PageContainer from "@src/components/shared/PageContainer";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useAkashProviders } from "@src/context/AkashProvider";
import { WelcomePanel } from "@src/components/home/WelcomePanel";
import { Box, CircularProgress } from "@mui/material";
import { Footer } from "@src/components/layout/Footer";

type Props = {
  children?: ReactNode;
};

const IndexPage: React.FunctionComponent<Props> = ({}) => {
  const { address, isWalletLoaded } = useKeplr();
  const [activeDeployments, setActiveDeployments] = useState([]);
  const { isFetching: isLoadingDeployments, refetch: getDeployments } = useDeploymentList(address, {
    enabled: false,
    onSuccess: _deployments => {
      setActiveDeployments(
        _deployments
          ? [..._deployments]
              .filter(d => d.state === "active")
              .map(d => {
                const name = getDeploymentName(d.dseq);

                return {
                  ...d,
                  name
                };
              })
          : []
      );
    }
  });
  const { getDeploymentName } = useLocalNotes();
  const { settings, isSettingsInit } = useSettings();
  const { apiEndpoint } = settings;
  const { data: balances, isFetching: isLoadingBalances, refetch: getBalances } = useBalances(address, { enabled: false });
  const { providers, isLoadingProviders } = useAkashProviders();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });

  useEffect(() => {
    if (address) {
      getBalances();
      getLeases();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (isWalletLoaded && isSettingsInit) {
      getDeployments();
    }
  }, [isSettingsInit, isWalletLoaded, getDeployments, apiEndpoint, address]);

  return (
    <Layout isLoading={isLoadingDeployments || isLoadingBalances || isLoadingProviders || isLoadingLeases}>
      <PageContainer sx={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
        <div>
          <Box sx={{ marginBottom: "1rem" }}>
            <WelcomePanel />
          </Box>

          {isSettingsInit && isWalletLoaded ? (
            <YourAccount
              isLoadingBalances={isLoadingBalances}
              balances={balances}
              activeDeployments={activeDeployments}
              leases={leases}
              providers={providers}
            />
          ) : (
            <Box sx={{ padding: "2rem", display: "flex", justifyContent: "center" }}>
              <CircularProgress color="secondary" size="4rem" />
            </Box>
          )}
        </div>

        <Footer />
      </PageContainer>
    </Layout>
  );
};

export async function getServerSideProps() {
  return {
    props: {}
    //revalidate: 20
  };
}

export default IndexPage;
