"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { buttonVariants, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowLeft } from "iconoir-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";

import { createConfigureDraft } from "@src/components/deployments/ConfigureDeployment/useConfigureDraft/useConfigureDraft";
import { DeploymentAlerts } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";
import { useServices } from "@src/context/ServicesProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { useDeploymentLeaseList } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { extractRepositoryUrl } from "@src/services/remote-deploy/env-var-manager.service";
import { isLeaseLive } from "@src/utils/reclamationUtils";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../../layout/Layout";
import { Title } from "../../shared/Title";
import { DeploymentLeaseShell } from "../DeploymentLeaseShell";
import { DeploymentLogs } from "../DeploymentLogs";
import { LeaseRow } from "../LeaseRow";
import { ManifestUpdate } from "../ManifestUpdate/ManifestUpdate";
import { ReclamationBanner } from "../ReclamationBanner/ReclamationBanner";
import { DeploymentDetailHeader } from "./DeploymentDetailHeader";

export const DEPENDENCIES = {
  useServices,
  useWallet,
  useSettings,
  useUser,
  useRouter,
  useSearchParams,
  useDeploymentDetail,
  useDeploymentLeaseList,
  useProviderList,
  NextSeo,
  Layout,
  ReclamationBanner,
  DeploymentDetailHeader,
  LeaseRow,
  DeploymentLogs,
  DeploymentLeaseShell,
  ManifestUpdate,
  DeploymentAlerts
};

const TABS = ["DETAILS", "LOGS", "EVENTS", "SHELL", "SETTINGS", "BILLING"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  DETAILS: "Details",
  LOGS: "Logs",
  EVENTS: "Events",
  SHELL: "Shell",
  SETTINGS: "Settings",
  BILLING: "Billing & Notifications"
};

export interface DeploymentDetailProps {
  dseq: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentDetail: FC<DeploymentDetailProps> = ({ dseq, dependencies: d = DEPENDENCIES }) => {
  const { deploymentLocalStorage, sdlAnalyzer, analyticsService } = d.useServices();
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { address } = d.useWallet();
  const { isSettingsInit } = d.useSettings();
  const { user } = d.useUser();
  const isAlertsEnabled = !!user?.userId;

  const [activeTab, setActiveTab] = useState<Tab>("DETAILS");
  const [editedManifest, setEditedManifest] = useState<string | null>(null);
  const isRemoteDeploy = sdlAnalyzer.hasCiCdImage(editedManifest);
  const repo = isRemoteDeploy ? extractRepositoryUrl(editedManifest) : null;

  const { data: deployment, isFetching: isLoadingDeployment, refetch: getDeploymentDetail, error: deploymentError } = d.useDeploymentDetail(address, dseq);
  const {
    data: leases,
    isLoading: isLoadingLeases,
    refetch: getLeases,
    isSuccess: isLeasesLoaded
  } = d.useDeploymentLeaseList(address, deployment, {
    enabled: deployment?.state === "active",
    refetchOnWindowFocus: false
  });
  const { data: providers, isFetching: isLoadingProviders, refetch: getProviders } = d.useProviderList();

  const deploymentManifest = deployment ? deploymentLocalStorage.get(address, dseq)?.manifest || "" : "";
  const hasLeases = !!leases && leases.length > 0;
  const isActive = deployment?.state === "active" && !!leases?.some(isLeaseLive);
  const isDeploymentNotFound = !!deploymentError && (deploymentError as any).response?.data?.message?.includes("Deployment not found") && !isLoadingDeployment;

  useEffect(() => {
    if (isSettingsInit) getDeploymentDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsInit]);

  useEffect(() => {
    if (deployment) {
      getLeases();
      getProviders();
    }
  }, [deployment, getLeases, getProviders]);

  useEffect(
    function redirectWhenInProgressWithoutLease() {
      if (leases && deployment?.state === "active" && leases.length === 0 && !deployment.groups?.some(g => g.state === "paused")) {
        const localData = deploymentLocalStorage.get(address, dseq);
        const draftId = localData?.manifest ? createConfigureDraft(localData.manifest, localData.name) : undefined;
        router.replace(UrlService.configureDeployment({ dseq, draftId }));
      }
    },
    [address, deployment?.state, deployment?.groups, deploymentLocalStorage, dseq, leases, router]
  );

  const tabQuery = searchParams?.get("tab");
  useEffect(() => {
    if (tabQuery && (TABS as readonly string[]).includes(tabQuery)) {
      setActiveTab(tabQuery as Tab);
    }
  }, [tabQuery]);

  async function loadDeploymentDetail() {
    if (!isLoadingDeployment) {
      await getDeploymentDetail();
      await getLeases();
    }
  }

  function changeTab(tab: Tab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    analyticsService.track("navigate_tab", { category: "deployments", label: `Navigate tab ${tab} in deployment detail`, tab });
  }

  return (
    <d.Layout
      isLoading={isLoadingLeases || isLoadingDeployment || isLoadingProviders}
      isUsingSettings
      disableContainer
      containerClassName="flex min-h-[calc(100dvh_-_var(--app-header-height,57px)_-_4px)] flex-col px-6 pt-4"
    >
      <d.NextSeo title={`Deployment detail #${dseq}`} />

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
          <d.ReclamationBanner leases={leases} dseq={dseq} />

          <d.DeploymentDetailHeader deployment={deployment} leases={leases} providers={providers || []} />

          <Tabs value={activeTab} onValueChange={value => changeTab(value as Tab)} className="flex flex-1 flex-col">
            <div className="-mx-6 border-b border-t">
              <TabsList className="h-auto w-full justify-start gap-8 rounded-none border-0 bg-transparent px-6 py-0">
                {TABS.map(tab => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="-mb-px whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-3 text-base font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    {TAB_LABELS[tab]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="-mx-6 flex-1 bg-muted px-6 py-6">
              {activeTab === "DETAILS" && (
                <div>
                  {leases?.map((lease, i) => (
                    <d.LeaseRow
                      key={lease.id}
                      index={i}
                      lease={lease}
                      repo={repo}
                      deploymentManifest={deploymentManifest}
                      dseq={dseq}
                      providers={providers || []}
                      loadDeploymentDetail={loadDeploymentDetail}
                      isRemoteDeploy={isRemoteDeploy}
                    />
                  ))}
                  {!hasLeases && !isLoadingLeases && !isLoadingDeployment && <>This deployment doesn't have any leases</>}
                </div>
              )}

              {activeTab === "LOGS" && (isActive ? <d.DeploymentLogs leases={leases} selectedLogsMode="logs" /> : <TabInactiveState />)}
              {activeTab === "EVENTS" && (isActive ? <d.DeploymentLogs leases={leases} selectedLogsMode="events" /> : <TabInactiveState />)}
              {activeTab === "SHELL" && (isActive ? <d.DeploymentLeaseShell leases={leases} /> : <TabInactiveState />)}

              {activeTab === "SETTINGS" && leases && (
                <d.ManifestUpdate
                  editedManifest={editedManifest as string}
                  onManifestChange={setEditedManifest}
                  isRemoteDeploy={isRemoteDeploy}
                  deployment={deployment}
                  leases={leases}
                  closeManifestEditor={() => {
                    setActiveTab("DETAILS");
                    loadDeploymentDetail();
                  }}
                />
              )}

              {activeTab === "BILLING" &&
                (isAlertsEnabled ? (
                  <d.DeploymentAlerts deployment={deployment} onStateChange={() => undefined} />
                ) : (
                  <TabInactiveState label="Billing & notifications are coming soon." />
                ))}
            </div>
          </Tabs>
        </>
      )}
    </d.Layout>
  );
};

const TabInactiveState: FC<{ label?: string }> = ({ label = "Available when the deployment is active." }) => (
  <div className="py-12 text-center text-sm text-muted-foreground">{label}</div>
);
