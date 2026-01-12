"use client";

import type { FC } from "react";
import { useCallback } from "react";
import { useMemo } from "react";
import { createRef, useEffect, useState } from "react";
import { buttonVariants, Spinner, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowLeft } from "iconoir-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";

import { DeploymentAlerts } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";
import { useServices } from "@src/context/ServicesProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useNavigationGuard } from "@src/hooks/useNavigationGuard/useNavigationGuard";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { useDeploymentLeaseList } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { extractRepositoryUrl, isCiCdImageInYaml } from "@src/services/remote-deploy/env-var-manager.service";
import { RouteStep } from "@src/types/route-steps.type";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { Title } from "../shared/Title";
import { CreateCredentialsButton } from "./CreateCredentialsButton/CreateCredentialsButton";
import { DeploymentDetailTopBar } from "./DeploymentDetailTopBar";
import { DeploymentLeaseShell } from "./DeploymentLeaseShell";
import { DeploymentLogs } from "./DeploymentLogs";
import { DeploymentSubHeader } from "./DeploymentSubHeader";
import { LeaseRow } from "./LeaseRow";
import { ManifestUpdate } from "./ManifestUpdate";

export interface DeploymentDetailProps {
  dseq: string;
}

type Tab = "ALERTS" | "EVENTS" | "LOGS" | "SHELL" | "EDIT" | "LEASES";

export const DeploymentDetail: FC<DeploymentDetailProps> = ({ dseq }) => {
  const { analyticsService, deploymentLocalStorage } = useServices();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("LEASES");

  const [editedManifest, setEditedManifest] = useState<string | null>(null);
  const { address, isWalletLoaded, isManaged } = useWallet();
  const { isSettingsInit } = useSettings();
  const [leaseRefs, setLeaseRefs] = useState<Array<any>>([]);
  const [deploymentManifest, setDeploymentManifest] = useState<string | null>(null);
  const isRemoteDeploy: boolean = !!editedManifest && !!isCiCdImageInYaml(editedManifest);
  const repo: string | null = isRemoteDeploy ? extractRepositoryUrl(editedManifest) : null;
  const { user } = useUser();
  const isAlertsEnabled = useFlag("alerts") && !!user?.userId && isManaged;
  const [badgedTabs, setBadgedTabs] = useState<Partial<Record<Tab, boolean>>>({});

  const { data: deployment, isFetching: isLoadingDeployment, refetch: getDeploymentDetail, error: deploymentError } = useDeploymentDetail(address, dseq);
  const {
    data: leases,
    isLoading: isLoadingLeases,
    refetch: getLeases,
    remove: removeLeases,
    isSuccess: isLeasesLoaded
  } = useDeploymentLeaseList(address, deployment, {
    enabled: deployment?.state === "active",
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
  const providerCredentials = useProviderCredentials();
  const { data: providers, isFetching: isLoadingProviders, refetch: getProviders } = useProviderList();
  useEffect(() => {
    if (deployment) {
      getLeases();
      getProviders();
      const deploymentData = deploymentLocalStorage.get(address, dseq);
      setDeploymentManifest(deploymentData?.manifest || "");
    }
  }, [deployment, dseq, getLeases, getProviders, address, deploymentLocalStorage]);

  const isActive = deployment?.state === "active" && leases?.some(x => x.state === "active");

  const tabs = useMemo(() => {
    const tabs: { label: string; value: Tab; badged?: boolean }[] = [
      {
        value: "LEASES",
        label: "Leases"
      }
    ];

    if (isAlertsEnabled) {
      tabs.push({
        label: "Alerts",
        value: "ALERTS",
        badged: badgedTabs.ALERTS
      });
    }

    if (isActive) {
      tabs.push(
        {
          label: "Logs",
          value: "LOGS"
        },
        {
          label: "Shell",
          value: "SHELL"
        },
        {
          label: "Events",
          value: "EVENTS"
        }
      );
    }

    tabs.push({
      label: "Update",
      value: "EDIT"
    });

    return tabs;
  }, [badgedTabs.ALERTS, isActive, isAlertsEnabled]);

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
    if (!tabQuery) {
      return;
    }

    const tab = tabs.find(tab => tab.value === tabQuery);
    if (tab) {
      setActiveTab(tab.value);
    } else if (isLeasesLoaded) {
      router.replace(UrlService.deploymentDetails(dseq));
    }
  }, [tabQuery, logsModeQuery, leases, tabs, isLeasesLoaded, router, dseq]);

  async function loadDeploymentDetail() {
    if (!isLoadingDeployment) {
      const deploymentResult = await getDeploymentDetail();
      await getLeases();
      if (deploymentResult.data?.state === "active") {
        leaseRefs.forEach(lr => lr.current?.getLeaseStatus());
      }
    }
  }

  const changeTab = (tab: Tab) => {
    setActiveTab(tab);

    router.replace(UrlService.deploymentDetails(dseq, tab));

    analyticsService.track(`navigate_tab`, {
      category: "deployments",
      label: `Navigate tab ${tab} in deployment detail`,
      tab
    });
  };

  const recordAlertsChange = useCallback(
    ({ hasChanges }: { hasChanges: boolean }) =>
      setBadgedTabs(prevState => ({
        ...prevState,
        ALERTS: hasChanges
      })),
    [setBadgedTabs]
  );

  useNavigationGuard({
    enabled: isAlertsEnabled && !!badgedTabs.ALERTS,
    message: "You have unsaved alert configuration changes that will be lost. Would you like to continue?",
    skipWhen: params => params.to.startsWith(`/deployments/${dseq}`)
  });

  useWhen(deployment?.state !== "active", () => {
    setBadgedTabs({});
  });

  return (
    <Layout isLoading={isLoadingLeases || isLoadingDeployment || isLoadingProviders} isUsingSettings isUsingWallet containerClassName="pb-0">
      <NextSeo title={`Deployment detail #${dseq}`} />

      {deployment && (
        <DeploymentDetailTopBar
          address={address}
          loadDeploymentDetail={loadDeploymentDetail}
          removeLeases={removeLeases}
          onDeploymentClose={() => setActiveTab("LEASES")}
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

      {deployment && isLeasesLoaded && (
        <>
          <DeploymentSubHeader deployment={deployment} leases={leases} />

          <Tabs value={activeTab} onValueChange={value => changeTab(value as Tab)}>
            <TabsList
              className={cn("grid w-full", {
                "grid-cols-2": tabs.length === 2,
                "grid-cols-3": tabs.length === 3,
                "grid-cols-4": tabs.length === 4,
                "grid-cols-5": tabs.length === 5,
                "grid-cols-6": tabs.length === 6
              })}
            >
              {tabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                  {tab.badged && <span className="ml-4 inline-block h-2 w-2 rounded-full bg-red-500" />}
                </TabsTrigger>
              ))}
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
            {isAlertsEnabled && (
              <div className={cn({ hidden: activeTab !== "ALERTS" })}>
                <DeploymentAlerts deployment={deployment} onStateChange={recordAlertsChange} />
              </div>
            )}
            {activeTab === "LEASES" && (
              <div className="py-6">
                {leases && !providerCredentials.details.usable && <CreateCredentialsButton containerClassName="mb-4" afterCreate={loadDeploymentDetail} />}

                {leases &&
                  leases.map((lease, i) => (
                    <LeaseRow
                      repo={repo}
                      key={lease.id}
                      index={i}
                      lease={lease}
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
