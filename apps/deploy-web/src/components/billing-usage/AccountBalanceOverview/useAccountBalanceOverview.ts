"use client";
import { useMemo } from "react";

import { useLocalNotes } from "@src/components/LocalNoteManager/useLocalNotes";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useFlag } from "@src/hooks/useFlag";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useWalletSettingsQuery } from "@src/queries";
import { useBalances } from "@src/queries/useBalancesQuery";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { getAvgCostPerMonth, getLeasesCostPerBlockUsd, getTimeLeft, perBlockToHourly } from "@src/utils/priceUtils";
import { isLeaseLive } from "@src/utils/reclamationUtils";

export const DEPENDENCIES = {
  useWallet,
  usePricing,
  useUsdcDenom,
  useFlag,
  useWalletBalance,
  useBalances,
  useAllLeases,
  useWalletSettingsQuery,
  useLocalNotes
};

export type ReservedDeployment = {
  dseq: string;
  name: string;
  reservedUsd: number;
  perHourUsd: number;
};

export type AccountBalanceOverview = {
  totalUsd: number;
  reserved: number;
  available: number;
  deployments: ReservedDeployment[];
  activeDeploymentCount: number;
  perHour: number;
  perMonth: number;
  /** null when nothing is being spent (runway is effectively infinite). */
  lastsUntil: Date | null;
  runwayDays: number | null;
  autoReloadEnabled: boolean;
  /** The auto-top-up trigger balance to mark on the bar, or null when no marker should render (flag off, auto-reload off, or unset). */
  autoReloadThreshold: number | null;
  isLoading: boolean;
};

const HOURS_PER_DAY = 24;

export function useAccountBalanceOverview({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): AccountBalanceOverview {
  const { address } = d.useWallet();
  const { price, isLoaded: isPriceLoaded, udenomToUsd } = d.usePricing();
  const usdcDenom = d.useUsdcDenom();
  const { balance: walletBalance } = d.useWalletBalance();
  const { data: balances } = d.useBalances(address);
  const { data: leases } = d.useAllLeases(address);
  const { data: walletSettings } = d.useWalletSettingsQuery();
  const { getDeploymentName } = d.useLocalNotes();
  const isFixedThresholdEnabled = d.useFlag("auto_reload_fixed_threshold");

  const perHourByDseq = useMemo(() => {
    const map = new Map<string, number>();
    if (!leases || !isPriceLoaded) return map;
    for (const lease of leases.filter(isLeaseLive)) {
      const perBlockUsd = getLeasesCostPerBlockUsd([lease], price ?? 0, usdcDenom);
      map.set(lease.dseq, (map.get(lease.dseq) ?? 0) + perBlockToHourly(perBlockUsd));
    }
    return map;
  }, [leases, isPriceLoaded, price, usdcDenom]);

  const deployments = useMemo<ReservedDeployment[]>(() => {
    if (!balances) return [];
    return balances.activeDeployments
      .map(deployment => ({
        dseq: deployment.dseq,
        name: getDeploymentName(deployment.dseq) ?? `Deployment ${deployment.dseq}`,
        reservedUsd: deployment.escrowAccount.state.funds.reduce((sum, fund) => sum + udenomToUsd(fund.amount, fund.denom), 0),
        perHourUsd: perHourByDseq.get(deployment.dseq) ?? 0
      }))
      .sort((a, b) => b.reservedUsd - a.reservedUsd);
  }, [balances, getDeploymentName, udenomToUsd, perHourByDseq]);

  const spend = useMemo(() => {
    if (!leases || !isPriceLoaded) return { perBlockUsd: 0, perHour: 0, perMonth: 0 };
    const perBlockUsd = getLeasesCostPerBlockUsd(leases.filter(isLeaseLive), price ?? 0, usdcDenom);
    return { perBlockUsd, perHour: perBlockToHourly(perBlockUsd), perMonth: getAvgCostPerMonth(perBlockUsd) };
  }, [leases, isPriceLoaded, price, usdcDenom]);

  const totalUsd = walletBalance?.totalUsd ?? 0;
  const reserved = walletBalance?.totalDeploymentEscrowUSD ?? 0;
  const available = Math.max(0, totalUsd - reserved);
  const hasSpend = spend.perBlockUsd > 0;
  const autoReloadEnabled = walletSettings?.autoReloadEnabled ?? false;
  const autoReloadThreshold = isFixedThresholdEnabled && autoReloadEnabled ? walletSettings?.autoReloadThreshold ?? null : null;

  return {
    totalUsd,
    reserved,
    available,
    deployments,
    activeDeploymentCount: balances?.activeDeployments.length ?? 0,
    perHour: spend.perHour,
    perMonth: spend.perMonth,
    lastsUntil: hasSpend ? getTimeLeft(spend.perBlockUsd, totalUsd) : null,
    runwayDays: hasSpend ? Math.floor(totalUsd / spend.perHour / HOURS_PER_DAY) : null,
    autoReloadEnabled,
    autoReloadThreshold,
    isLoading: !walletBalance
  };
}
