"use client";

import type { FC } from "react";
import { createRef, useEffect, useState } from "react";
import { Alert, Button, buttonVariants, Spinner, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowLeft } from "iconoir-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";

import { useCertificate } from "@src/context/CertificateProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { useDeploymentLeaseList } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import { extractRepositoryUrl, isCiCdImageInYaml } from "@src/services/remote-deploy/remote-deployment-controller.service";
import { RouteStep } from "@src/types/route-steps.type";
import { getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { Title } from "../shared/Title";
import { DeploymentDetailTopBar } from "./DeploymentDetailTopBar";
import { DeploymentLeaseShell } from "./DeploymentLeaseShell";
import { DeploymentLogs } from "./DeploymentLogs";
import { DeploymentSubHeader } from "./DeploymentSubHeader";
import { LeaseRow } from "./LeaseRow";
import { ManifestUpdate } from "./ManifestUpdate";

export interface DeploymentDetailProps {
  dseq: string;
}

export const DeploymentDetail: FC<DeploymentDetailProps> = ({ dseq }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("LEASES");
  const [editedManifest, setEditedManifest] = useState<string | null>(null);
  const { address, isWalletLoaded } = useWallet();
  const { isSettingsInit } = useSettings();
  const [leaseRefs, setLeaseRefs] = useState<Array<any>>([]);
  const [deploymentManifest, setDeploymentManifest] = useState<string | null>(null);
  const isRemoteDeploy: boolean = !!editedManifest && !!isCiCdImageInYaml(editedManifest);
  const repo: string | null = isRemoteDeploy ? extractRepositoryUrl(editedManifest) : null;

  const { data: deployment, isFetching: isLoadingDeployment, refetch: getDeploymentDetail, error: deploymentError } = useDeploymentDetail(address, dseq);
  const {
    data: leases,
    isLoading: isLoadingLeases,
    refetch: getLeases,
    remove: removeLeases
  } = useDeploymentLeaseList(address, deployment, {
    enabled: !!deployment,
    refetchOnWindowFocus: false
  });
  useEffect(() => {
    if (leases) {
      // Redirect to select bids if has no lease
      if (deployment?.state === "active" && leases.length === 0) {
        router.replace(UrlService.newDeployment({ dseq, step: RouteStep.createLeases }));
      }

      // Set the array of refs for lease rows
      // To be able to refresh lease status when refreshing deployment detail
      if (leases.length > 0 && leases.length !== leaseRefs.length) {
        setLeaseRefs(elRefs =>
          Array(leases.length)
            .fill(null)
            .map((_, i) => elRefs[i] || createRef())
        );
      }
    }
  }, [deployment?.state, dseq, leaseRefs.length, leases, router]);

  const isDeploymentNotFound = deploymentError && (deploymentError as any).response?.data?.message?.includes("Deployment not found") && !isLoadingDeployment;
  const hasLeases = leases && leases.length > 0;
  const { isLocalCertMatching, localCert, isCreatingCert, createCertificate } = useCertificate();
  const { data: providers, isFetching: isLoadingProviders, refetch: getProviders } = useProviderList();
  useEffect(() => {
    if (deployment) {
      getLeases();
      getProviders();
      const deploymentData = getDeploymentLocalData(dseq);
      setDeploymentManifest(deploymentData?.manifest || "");
    }
  }, [deployment, dseq, getLeases, getProviders]);

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
    }
  }, [tabQuery, logsModeQuery, leases]);

  function loadDeploymentDetail() {
    if (!isLoadingDeployment) {
      getDeploymentDetail();
      getLeases();

      leaseRefs.forEach(lr => lr.current?.getLeaseStatus());
    }
  }

  async function _createCertificate() {
    await createCertificate();
    loadDeploymentDetail();
  }

  const onChangeTab = (value: string) => {
    setActiveTab(value);

    // clear tab mode
    if (value !== "LOGS" && (tabQuery || logsModeQuery)) {
      router.replace(UrlService.deploymentDetails(dseq));
    }

    analyticsService.track(`navigate_tab`, {
      category: "deployments",
      label: `Navigate tab ${value} in deployment detail`,
      tab: value
    });
  };

  return (
    <Layout isLoading={isLoadingLeases || isLoadingDeployment || isLoadingProviders} isUsingSettings isUsingWallet containerClassName="pb-0">
      <NextSeo title={`Deployment detail #${dseq}`} />

      {deployment && (
        <DeploymentDetailTopBar
          address={address}
          loadDeploymentDetail={loadDeploymentDetail}
          removeLeases={removeLeases}
          setActiveTab={setActiveTab}
          deployment={deployment}
          leases={leases}
        />
      )}

      {isDeploymentNotFound && (
        <div className="mt-8 text-center">
          <Title className="mb-2">404</Title>
          <p>This deployment does not exist or it was created using another wallet.</p>
          <div className="pt-4">
            <Link href={UrlService.home()} className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center space-x-2")}>
              <ArrowLeft className="text-sm" />
              <span>Go to homepage</span>
            </Link>
          </div>
        </div>
      )}

      {deployment && (
        <>
          <DeploymentSubHeader deployment={deployment} leases={leases} />

          <Tabs value={activeTab} onValueChange={onChangeTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="LEASES" data-testid="deployment-tab-leases">
                Leases
              </TabsTrigger>
              {isActive && (
                <TabsTrigger value="LOGS" data-testid="deployment-tab-logs">
                  Logs
                </TabsTrigger>
              )}
              {isActive && (
                <TabsTrigger value="SHELL" data-testid="deployment-tab-shell">
                  Shell
                </TabsTrigger>
              )}
              {isActive && (
                <TabsTrigger value="EVENTS" data-testid="deployment-tab-events">
                  Events
                </TabsTrigger>
              )}
              <TabsTrigger value="EDIT" data-testid="deployment-tab-update">
                Update
              </TabsTrigger>
            </TabsList>

            {activeTab === "EDIT" && deployment && leases && (
              <ManifestUpdate
                editedManifest={editedManifest as string}
                onManifestChange={setEditedManifest}
                isRemoteDeploy={isRemoteDeploy}
                deployment={deployment}
                leases={leases}
                closeManifestEditor={() => {
                  setActiveTab("EVENTS");
                  loadDeploymentDetail();
                }}
              />
            )}
            {activeTab === "LOGS" && <DeploymentLogs leases={leases} selectedLogsMode="logs" />}
            {activeTab === "EVENTS" && <DeploymentLogs leases={leases} selectedLogsMode="events" />}
            {activeTab === "SHELL" && <DeploymentLeaseShell leases={leases} />}
            {activeTab === "LEASES" && (
              <div className="py-4">
                {leases && (!localCert || !isLocalCertMatching) && (
                  <div className="mb-4">
                    <Alert variant="warning">You do not have a valid local certificate. You need to create a new one to view lease status and details.</Alert>

                    <Button className="mt-4" disabled={isCreatingCert} onClick={() => _createCertificate()}>
                      {isCreatingCert ? <Spinner size="small" /> : "Create Certificate"}
                    </Button>
                  </div>
                )}

                {leases &&
                  leases.map((lease, i) => (
                    <LeaseRow
                      repo={repo}
                      key={lease.id}
                      index={i}
                      lease={lease}
                      setActiveTab={setActiveTab}
                      ref={leaseRefs[i]}
                      deploymentManifest={deploymentManifest || ""}
                      dseq={dseq}
                      providers={providers || []}
                      loadDeploymentDetail={loadDeploymentDetail}
                      isRemoteDeploy={isRemoteDeploy}
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
    </Layout>
  );
};
