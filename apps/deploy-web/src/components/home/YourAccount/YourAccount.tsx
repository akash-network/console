"use client";
import React, { useMemo } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import { useBlockchainStatus } from "@src/context/BlockchainStatusProvider";
import { useWallet } from "@src/context/WalletProvider";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import sdlStore from "@src/store/sdlStore";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { getAvgCostPerMonth, getLeasesCostPerBlockUsd } from "@src/utils/priceUtils";
import { bytesToShrink } from "@src/utils/unitUtils";
import { AccountHeader } from "../AccountHeader";
import { AccountStatsCards } from "../AccountStatsCards/AccountStatsCards";
import { NoDeploymentsState } from "../NoDeploymentsState";
import { ResourceStatsGrid } from "../ResourceStatsGrid";

export const DEPENDENCIES = {
  Spinner,
  AccountHeader,
  AccountStatsCards,
  NoDeploymentsState,
  ResourceStatsGrid,
  useBlockchainStatus,
  useWallet
};

type Props = {
  isLoadingBalances: boolean;
  activeDeployments: Array<DeploymentDto>;
  leases: Array<LeaseDto> | null | undefined;
  providers: Array<ApiProviderList> | undefined;
  walletBalance: WalletBalance | null;
  dependencies?: typeof DEPENDENCIES;
};

const AVG_AMOUNT_OF_DAYS_IN_MONTH = 30.437;
const ONE_DAY_IN_HOURS = 24;

export const YourAccount: React.FunctionComponent<Props> = ({
  isLoadingBalances,
  walletBalance,
  activeDeployments,
  leases,
  providers,
  dependencies: d = DEPENDENCIES
}) => {
  const { isBlockchainDown } = d.useBlockchainStatus();
  const { address } = d.useWallet();
  const totalCpu = activeDeployments.map(d => d.cpuAmount).reduce((a, b) => a + b, 0);
  const totalGpu = activeDeployments.map(d => d.gpuAmount).reduce((a = 0, b = 0) => a + b, 0);
  const totalMemory = activeDeployments.map(d => d.memoryAmount).reduce((a, b) => a + b, 0);
  const totalStorage = activeDeployments.map(d => d.storageAmount).reduce((a, b) => a + b, 0);
  const _ram = bytesToShrink(totalMemory);
  const _storage = bytesToShrink(totalStorage);
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);

  const costs = useMemo(() => {
    if (!leases) return null;

    const totalCostPerBlock = getLeasesCostPerBlockUsd(leases.filter(isLeaseLive));
    const monthlyAvg = getAvgCostPerMonth(totalCostPerBlock);

    return {
      perMonth: monthlyAvg,
      perHour: monthlyAvg / (AVG_AMOUNT_OF_DAYS_IN_MONTH * ONE_DAY_IN_HOURS)
    };
  }, [leases]);
  const userProviders = useMemo(() => {
    if (!leases || !providers) return [];
    const activeLeases = leases.filter(isLeaseLive);
    return Array.from(new Set(activeLeases.map(x => x.provider)), providerAddress => {
      const provider = providers.find(p => p.owner === providerAddress);
      return { owner: provider?.owner || "", name: provider?.name || "Unknown" };
    });
  }, [leases, providers]);

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  const hasActiveDeployments = activeDeployments.length > 0;

  if (!address) return null;

  return (
    <div className="space-y-6">
      <d.AccountHeader onDeployClick={onDeployClick} isBlockchainDown={isBlockchainDown} />

      {isLoadingBalances && !walletBalance ? (
        <div className="flex h-[200px] items-center justify-center">
          <d.Spinner size="large" />
        </div>
      ) : (
        <d.AccountStatsCards
          walletBalance={walletBalance}
          activeDeploymentsCount={activeDeployments.length}
          costPerMonth={costs?.perMonth}
          costPerHour={costs?.perHour}
        />
      )}

      {hasActiveDeployments && userProviders && (
        <d.ResourceStatsGrid providers={userProviders} totalCpu={totalCpu} totalGpu={totalGpu || 0} memory={_ram} storage={_storage} />
      )}

      {!hasActiveDeployments && <d.NoDeploymentsState onDeployClick={onDeployClick} />}
    </div>
  );
};
