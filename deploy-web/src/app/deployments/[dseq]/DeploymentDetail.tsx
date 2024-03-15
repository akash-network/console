"use client";

import { useSearchParams, useRouter } from "next/navigation";
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
import { PageContainer } from "@src/components/shared/PageContainer";
import { DeploymentDetailTopBar } from "./DeploymentDetailTopBar";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@src/components/ui/tabs";
import { DeploymentSubHeader } from "./DeploymentSubHeader";
import { Alert } from "@src/components/ui/alert";
import { Button, buttonVariants } from "@src/components/ui/button";
import Spinner from "@src/components/shared/Spinner";
import { cn } from "@src/utils/styleUtils";
import { ArrowRight } from "iconoir-react";
import { ManifestUpdate } from "./ManifestUpdate";

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
  const searchParams = useSearchParams();
  const tabQuery = searchParams?.get("tab");
  const logsModeQuery = searchParams?.get("logsMode");

  useEffect(() => {
    if (isWalletLoaded && isSettingsInit) {
      getDeploymentDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletLoaded, isSettingsInit]);

  useEffect(() => {
    if (leases && leases.some(l => l.state === "active")) {
      if (tabQuery) {
        setActiveTab(tabQuery);
      }

      if (logsModeQuery && (logsModeQuery === "logs" || logsModeQuery === "events")) {
        setSelectedLogsMode(logsModeQuery);
      }
    }
  }, [tabQuery, logsModeQuery, leases]);

  function loadDeploymentDetail() {
    if (!isLoadingDeployment) {
      getDeploymentDetail();
      getLeases();

      leaseRefs.forEach(lr => lr.current?.getLeaseStatus());
    }
  }

  const onChangeTab = value => {
    setActiveTab(value);

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
    <PageContainer isLoading={isLoadingLeases || isLoadingDeployment || isLoadingProviders} isUsingSettings isUsingWallet>
      {/* <Layout isLoading={isLoadingLeases || isLoadingDeployment || isLoadingProviders} isUsingSettings isUsingWallet> */}

      {/* <PageContainer sx={{ padding: "1rem 0 0" }}> */}
      {deployment && (
        <DeploymentDetailTopBar
          address={address}
          loadDeploymentDetail={loadDeploymentDetail}
          removeLeases={removeLeases}
          setActiveTab={setActiveTab}
          deployment={deployment}
        />
      )}

      {isDeploymentNotFound && (
        <div className="mt-8 text-center">
          <h1>404</h1>
          <h5>This deployment does not exist or it was created using another wallet.</h5>
          <div className="pt-4">
            <Link href={UrlService.home()} className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
              Go to homepage&nbsp;
              <ArrowRight fontSize="small" />
            </Link>
          </div>
        </div>
      )}

      {deployment && (
        <>
          <DeploymentSubHeader deployment={deployment} leases={leases} />

          {/* <Tabs
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
          </Tabs> */}

          <Tabs value={activeTab} onValueChange={onChangeTab}>
            <TabsList className="mb-4 grid w-full grid-cols-4">
              <TabsTrigger value="LEASES">Leases</TabsTrigger>
              {isActive && <TabsTrigger value="LOGS">Logs</TabsTrigger>}
              {isActive && <TabsTrigger value="SHELL">Shell</TabsTrigger>}
              {isActive && <TabsTrigger value="EVENTS">Events</TabsTrigger>}
              <TabsTrigger value="EDIT">Update</TabsTrigger>
            </TabsList>

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
              <div className="p-4">
                {leases && (!localCert || !isLocalCertMatching) && (
                  <div className="mb-4">
                    <Alert variant="warning">You do not have a valid local certificate. You need to create a new one to view lease status and details.</Alert>

                    <Button className="mt-4" disabled={isCreatingCert} onClick={() => createCertificate()}>
                      {isCreatingCert ? <Spinner size="medium" /> : "Create Certificate"}
                    </Button>
                  </div>
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
                  <div className="flex items-center justify-center p-8">
                    <Spinner size="large" />
                  </div>
                )}
              </div>
            )}
          </Tabs>
        </>
      )}
    </PageContainer>
  );
}
