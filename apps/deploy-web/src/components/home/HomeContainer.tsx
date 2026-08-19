"use client";
import React from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useWallet } from "@src/context/WalletProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { DeploymentDto } from "@src/types/deployment";
import { LIVE_LEASE_STATES } from "@src/utils/leaseUtils";
import Layout from "../layout/Layout";
import { WelcomePanel } from "./WelcomePanel";

const YourAccount = dynamic(() => import("./YourAccount/YourAccount").then(m => m.YourAccount), {
  ssr: false
});

export const DEPENDENCIES = {
  useWallet,
  useLocalNotes,
  useWalletBalance,
  useProviderList,
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
  const [activeDeployments, setActiveDeployments] = useState<DeploymentDto[]>([]);
  const { getDeploymentName } = d.useLocalNotes();
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
  useEffect(() => {
    if (deployments) {
      setActiveDeployments(deployments.map(d => ({ ...d, name: getDeploymentName(d.dseq) })));
    }
  }, [deployments, getDeploymentName]);

  const { balance: walletBalance, isLoading: isLoadingBalances } = d.useWalletBalance();
  const { data: providers, isFetching: isLoadingProviders } = d.useProviderList();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = d.useAllLeases(address, { enabled: false, state: LIVE_LEASE_STATES });

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
            providers={providers}
          />
        )}
      </div>
    </d.Layout>
  );
}
