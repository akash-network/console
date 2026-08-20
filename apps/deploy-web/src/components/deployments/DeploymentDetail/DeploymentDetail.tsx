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
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { useDeploymentLeaseList } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../../layout/Layout";
import { Title } from "../../shared/Title";
import { DeploymentLeaseShell } from "../DeploymentLeaseShell";
import { DeploymentLogs } from "../DeploymentLogs";
import { ManifestUpdate } from "../ManifestUpdate/ManifestUpdate";
import { ReclamationBanner } from "../ReclamationBanner/ReclamationBanner";
import { DeploymentPlacements } from "./DeploymentPlacements/DeploymentPlacements";
import { DeploymentSettings } from "./DeploymentSettings/DeploymentSettings";
import { DeploymentDetailHeader } from "./DeploymentDetailHeader";

export const DEPENDENCIES = {
  useServices,
  useWallet,
  useRouter,
  useSearchParams,
  useRedeploy,
  useDeploymentDetail,
  useDeploymentLeaseList,
  useProviderList,
  NextSeo,
  Layout,
  ReclamationBanner,
  DeploymentDetailHeader,
  DeploymentPlacements,
  DeploymentLogs,
  DeploymentLeaseShell,
  ManifestUpdate,
  DeploymentSettings
};

/** Matches Layout's default `container p-6` content column so every band lines up with the deployment list and the
 *  other pages. Sits inside each full-bleed wrapper, so the header, tab labels and tab body all share one left edge. */
const PAGE_BAND = "container px-6";

const TABS = ["DETAILS", "LOGS", "EVENTS", "SHELL", "UPDATE", "SETTINGS"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  DETAILS: "Details",
  LOGS: "Logs",
  EVENTS: "Events",
  SHELL: "Shell",
  UPDATE: "Update",
  SETTINGS: "Settings"
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
  const redeploy = d.useRedeploy();

  const [activeTab, setActiveTab] = useState<Tab>("DETAILS");
  const [editedManifest, setEditedManifest] = useState<string | null>(null);
  const isRemoteDeploy = sdlAnalyzer.hasCiCdImage(editedManifest);

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

  const storedDeployment = deployment ? deploymentLocalStorage.get(address, dseq) : null;
  const deploymentManifest = storedDeployment?.manifest || "";
  const isActive = deployment?.state === "active" && !!leases?.some(isLeaseLive);
  const isDeploymentNotFound = !!deploymentError && (deploymentError as any).response?.data?.message?.includes("Deployment not found") && !isLoadingDeployment;

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

  function redeployFromStoredManifest() {
    redeploy({ sdl: storedDeployment?.manifest, name: storedDeployment?.name });
    analyticsService.track("redeploy_btn_clk", "Amplitude");
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
      disableContainer
      containerClassName="flex min-h-[calc(100dvh_-_var(--app-header-height,57px)_-_4px)] flex-col pt-4"
    >
      <d.NextSeo title={`Deployment detail #${dseq}`} />

      {isDeploymentNotFound && (
        <div className={cn(PAGE_BAND, "mt-8 text-center")}>
          <Title className="mb-2">404</Title>
          <p>This deployment does not exist or it was created using another wallet.</p>
          <div className="pt-4">
            <Link href={UrlService.home()} className={cn(buttonVariants({ variant: "default", size: "md" }), "inline-flex items-center space-x-2")}>
              <ArrowLeft className="text-sm" />
              <span>Go to homepage</span>
            </Link>
          </div>
        </div>
      )}

      {deployment && isLeasesLoaded && (
        <>
          <div className={PAGE_BAND}>
            <d.DeploymentDetailHeader deployment={deployment} leases={leases} providers={providers || []} />

            <d.ReclamationBanner leases={leases} dseq={dseq} className="mb-6" />
          </div>

          <Tabs value={activeTab} onValueChange={value => changeTab(value as Tab)} className="flex flex-1 flex-col">
            <div className="border-b border-t">
              <TabsList className={cn("flex h-auto justify-start gap-8 rounded-none border-0 bg-transparent py-0", PAGE_BAND)}>
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

            <div className="flex-1 bg-muted py-6">
              <div className={PAGE_BAND}>
                {activeTab === "DETAILS" && (
                  <d.DeploymentPlacements
                    leases={leases || []}
                    providers={providers || []}
                    deploymentManifest={deploymentManifest}
                    dseq={dseq}
                    onClosed={loadDeploymentDetail}
                  />
                )}

                {activeTab === "LOGS" && (isActive ? <d.DeploymentLogs leases={leases} selectedLogsMode="logs" /> : <TabInactiveState />)}
                {activeTab === "EVENTS" && (isActive ? <d.DeploymentLogs leases={leases} selectedLogsMode="events" /> : <TabInactiveState />)}
                {activeTab === "SHELL" && (isActive ? <d.DeploymentLeaseShell leases={leases} /> : <TabInactiveState />)}

                {activeTab === "UPDATE" && leases && (
                  <d.ManifestUpdate
                    editedManifest={editedManifest as string}
                    onManifestChange={setEditedManifest}
                    isRemoteDeploy={isRemoteDeploy}
                    deployment={deployment}
                    leases={leases}
                    onRedeploy={storedDeployment?.manifest ? redeployFromStoredManifest : undefined}
                    closeManifestEditor={() => {
                      changeTab("DETAILS");
                      loadDeploymentDetail();
                    }}
                  />
                )}

                {activeTab === "SETTINGS" && <d.DeploymentSettings deployment={deployment} leases={leases} onDeploymentChange={loadDeploymentDetail} />}
              </div>
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
