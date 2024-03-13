"use client";

import { useRouter } from "next/navigation";
import { createRef, useEffect, useState } from "react";
import { LOGS_MODE } from "./DeploymentLogs";
import { useWallet } from "@src/context/WalletProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { useDeploymentLeaseList } from "@src/queries/useLeaseQuery";
import { UrlService } from "@src/utils/urlUtils";
import { RouteStepKeys } from "@src/utils/constants";
import { useCertificate } from "@src/context/CertificateProvider";
import { useProviderList } from "@src/queries/useProvidersQuery";

// const useStyles = makeStyles()(theme => ({
//   tabsRoot: {
//     minHeight: "36px",
//     borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[200],
//     "& button": {
//       minHeight: "36px"
//     }
//   },
//   selectedTab: {
//     fontWeight: "bold"
//   }
// }));

export function DeploymentDetail({ dseq }: React.PropsWithChildren<{ dseq: string }>) {
  // const { classes } = useStyles();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("LEASES");
  const [selectedLogsMode, setSelectedLogsMode] = useState<LOGS_MODE>("logs");
  const { address, isWalletLoaded } = useWallet();
  const { isSettingsInit } = useSettings();
  const [leaseRefs, setLeaseRefs] = useState<Array<any>>([]);
  const [deploymentManifest, setDeploymentManifest] = useState<string | null>(null);
  const {
    data: deployment,
    isFetching: isLoadingDeployment,
    refetch: getDeploymentDetail,
    error: deploymentError
  } = useDeploymentDetail(address, dseq, {
    enabled: false,
    onSuccess: _deploymentDetail => {
      if (_deploymentDetail) {
        getLeases();
        getProviders();

        const deploymentData = getDeploymentLocalData(dseq);
        setDeploymentManifest(deploymentData?.manifest || "");
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
        if (deployment?.state === "active" && _leases.length === 0) {
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
  const isDeploymentNotFound = deploymentError && (deploymentError as any).response?.data?.message?.includes("Deployment not found");
  const hasLeases = leases && leases.length > 0;
  const { isLocalCertMatching, localCert, isCreatingCert, createCertificate } = useCertificate();
  const { data: providers, isFetching: isLoadingProviders, refetch: getProviders } = useProviderList();
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

    // event(`${AnalyticsEvents.NAVIGATE_TAB}${value}`, {
    //   category: "deployments",
    //   label: `Navigate tab ${value} in deployment detail`
    // });
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

        {isDeploymentNotFound && (
          <Box sx={{ textAlign: "center", marginTop: 10 }}>
            <Typography variant="h1">404</Typography>
            <Typography variant="subtitle1">This deployment does not exist or it was created using another wallet.</Typography>
            <Box sx={{ paddingTop: "1rem" }}>
              <Link href={UrlService.home()} passHref>
                <Button variant="contained" color="secondary" sx={{ display: "inline-flex", alignItems: "center", textTransform: "initial" }}>
                  Go to homepage&nbsp;
                  <ArrowForwardIcon fontSize="small" />
                </Button>
              </Link>
            </Box>
          </Box>
        )}

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
}
