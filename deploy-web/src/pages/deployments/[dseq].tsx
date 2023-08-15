import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import { DeploymentDetailTopBar } from "@src/components/deploymentDetail/DeploymentDetailTopBar";
import { DeploymentSubHeader } from "@src/components/deploymentDetail/DeploymentSubHeader";
import { Alert, Box, Button, CircularProgress, Tab, Tabs } from "@mui/material";
import { LeaseRow } from "@src/components/deploymentDetail/LeaseRow";
import { useRouter } from "next/router";
import { createRef, useEffect, useState } from "react";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { useDeploymentLeaseList } from "@src/queries/useLeaseQuery";
import { useCertificate } from "@src/context/CertificateProvider";
import { useAkashProviders } from "@src/context/AkashProvider";
import { getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { ManifestUpdate } from "@src/components/deploymentDetail/ManifestUpdate";
import { DeploymentLogs, LOGS_MODE } from "@src/components/deploymentDetail/DeploymentLogs";
import { DeploymentLeaseShell } from "@src/components/deploymentDetail/DeploymentLeaseShell";
import { UrlService } from "@src/utils/urlUtils";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { RouteStepKeys } from "@src/utils/constants";
import { useSettings } from "@src/context/SettingsProvider";
import PageContainer from "@src/components/shared/PageContainer";

type Props = {
  dseq: string;
};

const useStyles = makeStyles()(theme => ({
  tabsRoot: {
    minHeight: "36px",
    borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[200],
    "& button": {
      minHeight: "36px"
    }
  },
  selectedTab: {
    fontWeight: "bold"
  }
}));

const DeploymentDetailPage: React.FunctionComponent<Props> = ({ dseq }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("LEASES");
  const [selectedLogsMode, setSelectedLogsMode] = useState<LOGS_MODE>("logs");
  const { address, isWalletLoaded } = useKeplr();
  const { isSettingsInit } = useSettings();
  const [leaseRefs, setLeaseRefs] = useState<Array<any>>([]);
  const {
    data: deployment,
    isFetching: isLoadingDeployment,
    refetch: getDeploymentDetail
  } = useDeploymentDetail(address, dseq, {
    enabled: false,
    onSuccess: _deploymentDetail => {
      if (_deploymentDetail) {
        getLeases();
        getProviders();

        const deploymentData = getDeploymentLocalData(dseq);
        setDeploymentManifest(deploymentData?.manifest);
      }
    }
  });
  const {
    data: leases,
    isLoading: isLoadingLeases,
    refetch: getLeases,
    remove: removeLeases
  } = useDeploymentLeaseList(address, deployment, {
    enabled: !!deployment,
    refetchOnWindowFocus: false,
    onSuccess: _leases => {
      if (_leases) {
        // Redirect to select bids if has no lease
        if (deployment.state === "active" && _leases.length === 0) {
          router.replace(UrlService.newDeployment({ dseq, step: RouteStepKeys.createLeases }));
        }

        // Set the array of refs for lease rows
        // To be able to refresh lease status when refresh deployment detail
        if (_leases.length > 0 && _leases.length !== leaseRefs.length) {
          setLeaseRefs(elRefs =>
            Array(_leases.length)
              .fill(null)
              .map((_, i) => elRefs[i] || createRef())
          );
        }
      }
    }
  });
  const hasLeases = leases && leases.length > 0;
  const { isLocalCertMatching, localCert, isCreatingCert, createCertificate } = useCertificate();
  const [deploymentManifest, setDeploymentManifest] = useState(null);
  const { providers, getProviders, isLoadingProviders } = useAkashProviders();
  const isActive = deployment?.state === "active" && leases?.some(x => x.state === "active");

  useEffect(() => {
    if (isWalletLoaded && isSettingsInit) {
      getDeploymentDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletLoaded, isSettingsInit]);

  useEffect(() => {
    if (leases && leases.some(l => l.state === "active")) {
      const tabQuery = router.query.tab as string;
      const logsModeQuery = router.query.logsMode as string;

      if (tabQuery) {
        setActiveTab(tabQuery);
      }

      if (logsModeQuery && (logsModeQuery === "logs" || logsModeQuery === "events")) {
        setSelectedLogsMode(logsModeQuery);
      }
    }
  }, [router.query, leases]);

  function loadDeploymentDetail() {
    if (!isLoadingDeployment) {
      getDeploymentDetail();
      getLeases();

      leaseRefs.forEach(lr => lr.current?.getLeaseStatus());
    }
  }

  const onChangeTab = async (ev, value) => {
    setActiveTab(value);

    const tabQuery = router.query.tab as string;
    const logsModeQuery = router.query.logsMode as string;

    // clear tab mode
    if (value !== "LOGS" && (tabQuery || logsModeQuery)) {
      router.replace(UrlService.deploymentDetails(dseq));
    }

    event(`${AnalyticsEvents.NAVIGATE_TAB}${value}`, {
      category: "deployments",
      label: `Navigate tab ${value} in deployment detail`
    });
  };

  return (
    <Layout isLoading={isLoadingLeases || isLoadingDeployment || isLoadingProviders} isUsingSettings isUsingWallet>
      <NextSeo title={`Deployment detail #${dseq}`} />

      <PageContainer sx={{ padding: "1rem 0 0" }}>
        <DeploymentDetailTopBar
          address={address}
          loadDeploymentDetail={loadDeploymentDetail}
          removeLeases={removeLeases}
          setActiveTab={setActiveTab}
          deployment={deployment}
        />

        {deployment && (
          <>
            <DeploymentSubHeader deployment={deployment} leases={leases} />

            <Tabs
              value={activeTab}
              onChange={onChangeTab}
              indicatorColor="secondary"
              textColor="secondary"
              classes={{ root: classes.tabsRoot }}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab value="LEASES" label="Leases" classes={{ selected: classes.selectedTab }} />
              {isActive && <Tab value="LOGS" label="Logs" classes={{ selected: classes.selectedTab }} />}
              {isActive && <Tab value="SHELL" label="Shell" classes={{ selected: classes.selectedTab }} />}
              {isActive && <Tab value="EVENTS" label="Events" classes={{ selected: classes.selectedTab }} />}

              <Tab value="EDIT" label="Update" classes={{ selected: classes.selectedTab }} />
            </Tabs>

            {activeTab === "EDIT" && deployment && leases && (
              <ManifestUpdate
                deployment={deployment}
                leases={leases}
                closeManifestEditor={() => {
                  setActiveTab("EVENTS");
                  setSelectedLogsMode("events");
                  loadDeploymentDetail();
                }}
              />
            )}
            {activeTab === "LOGS" && <DeploymentLogs leases={leases} selectedLogsMode="logs" />}
            {activeTab === "EVENTS" && <DeploymentLogs leases={leases} selectedLogsMode="events" />}
            {activeTab === "SHELL" && <DeploymentLeaseShell leases={leases} />}
            {activeTab === "LEASES" && (
              <Box padding="1rem">
                {leases && (!localCert || !isLocalCertMatching) && (
                  <Box marginBottom="1rem">
                    <Alert severity="warning">You do not have a valid local certificate. You need to create a new one to view lease status and details.</Alert>

                    <Button
                      variant="contained"
                      color="secondary"
                      size="medium"
                      sx={{ marginTop: "1rem" }}
                      disabled={isCreatingCert}
                      onClick={() => createCertificate()}
                    >
                      {isCreatingCert ? <CircularProgress size="1.5rem" color="secondary" /> : "Create Certificate"}
                    </Button>
                  </Box>
                )}

                {leases &&
                  leases.map((lease, i) => (
                    <LeaseRow
                      key={lease.id}
                      lease={lease}
                      setActiveTab={setActiveTab}
                      ref={leaseRefs[i]}
                      deploymentManifest={deploymentManifest}
                      dseq={dseq}
                      providers={providers}
                      loadDeploymentDetail={loadDeploymentDetail}
                    />
                  ))}

                {!hasLeases && !isLoadingLeases && !isLoadingDeployment && <>This deployment doesn't have any leases</>}

                {(isLoadingLeases || isLoadingDeployment) && !hasLeases && (
                  <Box textAlign="center" padding="2rem">
                    <CircularProgress color="secondary" />
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </PageContainer>
    </Layout>
  );
};

export default DeploymentDetailPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      dseq: params?.dseq
    }
  };
}
