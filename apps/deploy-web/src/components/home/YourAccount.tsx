"use client";
import React, { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import sdlStore from "@src/store/sdlStore";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getAvgCostPerMonth } from "@src/utils/priceUtils";
import { bytesToShrink } from "@src/utils/unitUtils";
import { ConnectWallet } from "../shared/ConnectWallet";
import { AccountHeader } from "./AccountHeader";
import { AccountStatsCards } from "./AccountStatsCards";
import { CurrentProviders } from "./CurrentProviders";
import { NoDeploymentsState } from "./NoDeploymentsState";
import { ResourceStatsGrid } from "./ResourceStatsGrid";

type Props = {
  isLoadingBalances: boolean;
  activeDeployments: Array<DeploymentDto>;
  leases: Array<LeaseDto> | null | undefined;
  providers: Array<ApiProviderList> | undefined;
  walletBalance: WalletBalance | null;
};

export const YourAccount: React.FunctionComponent<Props> = ({ isLoadingBalances, walletBalance, activeDeployments, leases, providers }) => {
  const { settings } = useSettings();
  const { address, isManaged: isManagedWallet } = useWallet();
  const usdcIbcDenom = useUsdcDenom();
  const [costPerMonth, setCostPerMonth] = useState<number | null>(null);
  const [costPerHour, setCostPerHour] = useState<number | null>(null);
  const [userProviders, setUserProviders] = useState<{ owner: string; name: string }[] | null>(null);
  const totalCpu = activeDeployments.map(d => d.cpuAmount).reduce((a, b) => a + b, 0);
  const totalGpu = activeDeployments.map(d => d.gpuAmount).reduce((a = 0, b = 0) => a + b, 0);
  const totalMemory = activeDeployments.map(d => d.memoryAmount).reduce((a, b) => a + b, 0);
  const totalStorage = activeDeployments.map(d => d.storageAmount).reduce((a, b) => a + b, 0);
  const _ram = bytesToShrink(totalMemory);
  const _storage = bytesToShrink(totalStorage);
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const { price, isLoaded } = usePricing();

  useEffect(() => {
    if (leases && providers && price && isLoaded) {
      const activeLeases = leases.filter(x => x.state === "active");
      const totalCostPerBlock = activeLeases
        .map(x => {
          switch (x.price.denom) {
            case UAKT_DENOM:
              return udenomToDenom(x.price.amount, 10) * price;
            case usdcIbcDenom:
              return udenomToDenom(x.price.amount, 10);

            default:
              return 0;
          }
        })
        .reduce((a, b) => a + b, 0);

      const _userProviders = activeLeases
        .map(x => x.provider)
        .filter((value, index, array) => array.indexOf(value) === index)
        .map(x => {
          const provider = providers.find(p => p.owner === x);
          return { owner: provider?.owner || "", name: provider?.name || "Unknown" };
        });

      const monthlyAvg = getAvgCostPerMonth(totalCostPerBlock);
      setCostPerMonth(monthlyAvg);
      setCostPerHour(monthlyAvg / (30.437 * 24));
      setUserProviders(_userProviders);
    }
  }, [leases, providers, price, isLoaded, usdcIbcDenom]);

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  const hasActiveDeployments = activeDeployments.length > 0;

  return (
    <>
      {address && (
        <div className="space-y-6">
          <AccountHeader isManagedWallet={isManagedWallet} onDeployClick={onDeployClick} isBlockchainDown={settings.isBlockchainDown} />

          {isLoadingBalances && !walletBalance ? (
            <div className="flex h-[200px] items-center justify-center">
              <Spinner size="large" />
            </div>
          ) : (
            <AccountStatsCards
              walletBalance={walletBalance}
              activeDeploymentsCount={activeDeployments.length}
              costPerMonth={costPerMonth}
              costPerHour={costPerHour}
            />
          )}

          {hasActiveDeployments && (
            <>
              <CurrentProviders providers={userProviders} />
              <ResourceStatsGrid totalCpu={totalCpu} totalGpu={totalGpu || 0} memory={_ram} storage={_storage} />
            </>
          )}

          {!hasActiveDeployments && address && <NoDeploymentsState onDeployClick={onDeployClick} />}
        </div>
      )}

      {!address && <ConnectWallet text="Setup your billing to deploy!" />}
    </>
  );
};
export default YourAccount;
