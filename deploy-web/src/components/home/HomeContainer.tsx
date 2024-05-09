"use client";
import { useEffect, useState } from "react";
import React from "react";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useBalances } from "@src/queries/useBalancesQuery";
import { useWallet } from "@src/context/WalletProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { Footer } from "@src/components/layout/Footer";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { DeploymentDto } from "@src/types/deployment";
import { WelcomePanel } from "./WelcomePanel";
import Layout from "../layout/Layout";
import { YourAccount } from "./YourAccount";
import Spinner from "../shared/Spinner";

export function HomeContainer() {
  const { address, isWalletLoaded } = useWallet();
  const [activeDeployments, setActiveDeployments] = useState<DeploymentDto[]>([]);
  const { getDeploymentName } = useLocalNotes();
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
  const { settings, isSettingsInit } = useSettings();
  const { apiEndpoint } = settings;
  const { data: balances, isFetching: isLoadingBalances, refetch: getBalances } = useBalances(address, { enabled: false });
  const { data: providers, isFetching: isLoadingProviders } = useProviderList();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });

  useEffect(() => {
    if (address && isSettingsInit) {
      getBalances();
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
        {isSettingsInit && isWalletLoaded ? (
          <YourAccount isLoadingBalances={isLoadingBalances} balances={balances} activeDeployments={activeDeployments} leases={leases} providers={providers} />
        ) : (
          <div className="flex justify-center p-8">
            <Spinner size="large" />
          </div>
        )}
      </div>

      <Footer />
    </Layout>
  );
}
