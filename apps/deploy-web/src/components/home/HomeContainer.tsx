"use client";
import { useEffect, useState } from "react";
import React from "react";
import dynamic from "next/dynamic";

import { Footer } from "@src/components/layout/Footer";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { DeploymentDto } from "@src/types/deployment";
import Layout from "../layout/Layout";
import { WelcomePanel } from "./WelcomePanel";

const YourAccount = dynamic(() => import("./YourAccount"), {
  ssr: false
});

export function HomeContainer() {
  const { address, isWalletLoaded } = useWallet();
  const [activeDeployments, setActiveDeployments] = useState<DeploymentDto[]>([]);
  const { getDeploymentName } = useLocalNotes();
  const {
    data: deployments,
    isFetching: isLoadingDeployments,
    refetch: getDeployments
  } = useDeploymentList(address, {
    enabled: false
  });
  useEffect(() => {
    setActiveDeployments(
      deployments
        ? [...deployments]
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
  }, [deployments, getDeploymentName]);

  const { settings, isSettingsInit } = useSettings();
  const { apiEndpoint } = settings;
  const { balance: walletBalance, isLoading: isLoadingBalances } = useWalletBalance();
  const { data: providers, isFetching: isLoadingProviders } = useProviderList();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });

  useEffect(() => {
    if (address && isSettingsInit) {
      getLeases();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isSettingsInit]);

  useEffect(() => {
    if (isWalletLoaded && isSettingsInit) {
      getDeployments();
    }
  }, [isSettingsInit, isWalletLoaded, getDeployments, apiEndpoint, address]);

  return (
    <Layout
      containerClassName="flex h-full flex-col justify-between"
      isLoading={isLoadingDeployments || isLoadingBalances || isLoadingProviders || isLoadingLeases}
    >
      <div>
        <div className="mb-4">
          <WelcomePanel />
        </div>
        {isSettingsInit && !!address && (
          <YourAccount
            isLoadingBalances={isLoadingBalances}
            walletBalance={walletBalance}
            activeDeployments={activeDeployments}
            leases={leases}
            providers={providers}
          />
        )}
      </div>

      <Footer />
    </Layout>
  );
}
