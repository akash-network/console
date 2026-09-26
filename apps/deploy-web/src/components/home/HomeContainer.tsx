"use client";
import React from "react";
import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";

import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useProvidersByAddresses } from "@src/queries/useProvidersQuery";
import type { DeploymentDto } from "@src/types/deployment";
import { isLeaseLive, LIVE_LEASE_STATES } from "@src/utils/leaseUtils";
import Layout from "../layout/Layout";
import { WelcomePanel } from "./WelcomePanel";

const YourAccount = dynamic(() => import("./YourAccount/YourAccount").then(m => m.YourAccount), {
  ssr: false
});

export const DEPENDENCIES = {
  useWallet,
  useDeploymentNames,
  useWalletBalance,
  useProvidersByAddresses,
  useDeploymentList,
  useAllLeases,
  Layout,
  WelcomePanel,
  YourAccount
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function HomeContainer({ dependencies: d = DEPENDENCIES }: Props) {
  const { address } = d.useWallet();
  const {
    data: deployments,
    isFetching: isLoadingDeployments,
    refetch: getDeployments
  } = d.useDeploymentList(
    address,
    {
      enabled: false
    },
    "active"
  );
  const { getDeploymentName } = d.useDeploymentNames(deployments?.map(deployment => deployment.dseq) ?? []);
  const activeDeployments = useMemo<DeploymentDto[]>(
    () => deployments?.map(deployment => ({ ...deployment, name: getDeploymentName(deployment.dseq) })) ?? [],
    [deployments, getDeploymentName]
  );

  const { balance: walletBalance, isLoading: isLoadingBalances } = d.useWalletBalance();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = d.useAllLeases(address, { enabled: false, state: LIVE_LEASE_STATES });
  const liveLeaseProviderAddresses = useMemo(() => leases?.filter(isLeaseLive).map(lease => lease.provider) ?? [], [leases]);
  const { data: providers, isFetching: isLoadingProviders, isLoading: isResolvingProviders } = d.useProvidersByAddresses(liveLeaseProviderAddresses);

  useEffect(() => {
    if (address) {
      getLeases();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    getDeployments();
  }, [getDeployments, address]);

  return (
    <d.Layout
      containerClassName="flex h-full flex-col justify-between"
      isLoading={isLoadingDeployments || isLoadingBalances || isLoadingProviders || isLoadingLeases}
    >
      <div>
        <div className="mb-6">
          <d.WelcomePanel />
        </div>
        {!!address && (
          <d.YourAccount
            isLoadingBalances={isLoadingBalances}
            walletBalance={walletBalance}
            activeDeployments={activeDeployments}
            leases={leases}
            providers={isResolvingProviders ? undefined : providers}
          />
        )}
      </div>
    </d.Layout>
  );
}
