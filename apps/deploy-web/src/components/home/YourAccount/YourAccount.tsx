"use client";
import React, { useMemo } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
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
import { ConnectWallet } from "../../shared/ConnectWallet";
import { AccountHeader } from "../AccountHeader";
import { AccountStatsCards } from "../AccountStatsCards/AccountStatsCards";
import { NoDeploymentsState } from "../NoDeploymentsState";
import { ResourceStatsGrid } from "../ResourceStatsGrid";

export const DEPENDENCIES = {
  Spinner,
  ConnectWallet,
  AccountHeader,
  AccountStatsCards,
  NoDeploymentsState,
  ResourceStatsGrid,
  useSettings,
  useWallet,
  useUsdcDenom,
  usePricing
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
  const { settings } = d.useSettings();
  const { address, isManaged: isManagedWallet } = d.useWallet();
  const usdcIbcDenom = d.useUsdcDenom();
  const totalCpu = activeDeployments.map(d => d.cpuAmount).reduce((a, b) => a + b, 0);
  const totalGpu = activeDeployments.map(d => d.gpuAmount).reduce((a = 0, b = 0) => a + b, 0);
  const totalMemory = activeDeployments.map(d => d.memoryAmount).reduce((a, b) => a + b, 0);
  const totalStorage = activeDeployments.map(d => d.storageAmount).reduce((a, b) => a + b, 0);
  const _ram = bytesToShrink(totalMemory);
  const _storage = bytesToShrink(totalStorage);
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const { price, isLoaded: isAktPriceLoaded } = d.usePricing();

  const costs = useMemo(() => {
    if (!leases || !price || !isAktPriceLoaded) return null;

    const activeLeases = leases.filter(x => x.state === "active");
    const totalCostPerBlock = activeLeases
      .map(x => {
        switch (x.price.denom) {
          case UAKT_DENOM:
            return udenomToDenom(x.price.amount, 10) * price;
          case usdcIbcDenom:
          case UACT_DENOM:
            return udenomToDenom(x.price.amount, 10);
          default:
            return 0;
        }
      })
      .reduce((a, b) => a + b, 0);

    const monthlyAvg = getAvgCostPerMonth(totalCostPerBlock);

    return {
      perMonth: monthlyAvg,
      perHour: monthlyAvg / (AVG_AMOUNT_OF_DAYS_IN_MONTH * ONE_DAY_IN_HOURS)
    };
  }, [leases, price, isAktPriceLoaded, usdcIbcDenom]);
  const userProviders = useMemo(() => {
    if (!leases || !providers) return [];
    const activeLeases = leases.filter(x => x.state === "active");
    return Array.from(new Set(activeLeases.map(x => x.provider)), providerAddress => {
      const provider = providers.find(p => p.owner === providerAddress);
      return { owner: provider?.owner || "", name: provider?.name || "Unknown" };
    });
  }, [leases, providers]);

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  const hasActiveDeployments = activeDeployments.length > 0;

  return (
    <>
      {address && (
        <div className="space-y-6">
          <d.AccountHeader isManagedWallet={isManagedWallet} onDeployClick={onDeployClick} isBlockchainDown={settings.isBlockchainDown} />

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
              isManagedWallet={isManagedWallet}
            />
          )}

          {hasActiveDeployments && userProviders && (
            <d.ResourceStatsGrid providers={userProviders} totalCpu={totalCpu} totalGpu={totalGpu || 0} memory={_ram} storage={_storage} />
          )}

          {!hasActiveDeployments && address && <d.NoDeploymentsState onDeployClick={onDeployClick} />}
        </div>
      )}

      {!address && <d.ConnectWallet text="Setup your billing to deploy!" />}
    </>
  );
};
export default YourAccount;
