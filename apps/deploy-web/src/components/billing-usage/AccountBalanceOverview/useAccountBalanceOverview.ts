"use client";
import { useMemo } from "react";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";

import { useLocalNotes } from "@src/components/LocalNoteManager/useLocalNotes";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { computeWalletBalance } from "@src/hooks/useWalletBalance";
import { useWalletSettingsQuery } from "@src/queries";
import { useBalances } from "@src/queries/useBalancesQuery";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { isLeaseLive, LIVE_LEASE_STATES } from "@src/utils/leaseUtils";
import { getLeasesCostPerBlockUsd, getTimeLeft, perBlockToHourly } from "@src/utils/priceUtils";

export const DEPENDENCIES = {
  useWallet,
  usePricing,
  useFlag,
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
  perHour: number;
  /** null when nothing is being spent (runway is effectively infinite). */
  lastsUntil: Date | null;
  runwayDays: number | null;
  autoReloadEnabled: boolean;
  /** The auto-top-up trigger balance to mark on the bar, or null when no marker should render (flag off, auto-reload off, or unset). */
  autoReloadThreshold: number | null;
  isLoading: boolean;
  /** True when balances can't be loaded: the query errored out or the chain API fallback disabled it. */
  isError: boolean;
};

export function useAccountBalanceOverview({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): AccountBalanceOverview {
  const { address } = d.useWallet();
  const { price, udenomToUsd } = d.usePricing();
  const { data: balances, isError: isBalancesError, fetchStatus: balancesFetchStatus } = d.useBalances(address);
  const { data: leases } = d.useAllLeases(address, { state: LIVE_LEASE_STATES, enabled: !!address });
  const { data: walletSettings } = d.useWalletSettingsQuery();
  const { getDeploymentName } = d.useLocalNotes();
  const isFixedThresholdEnabled = d.useFlag("auto_reload_fixed_threshold");

  /** Not gated on the AKT market price: managed wallets hold ACT/USDC (1:1 USD), and blocking on market data would strand the card on its skeleton during an outage. */
  const walletBalance = useMemo(() => (balances ? computeWalletBalance(balances, price ?? 0, udenomToUsd) : null), [balances, price, udenomToUsd]);

  const { perHourByDseq, spend } = useMemo(() => {
    const perHourByDseq = new Map<string, number>();
    if (!leases) return { perHourByDseq, spend: { perBlockUsd: 0, perHour: 0 } };

    let totalPerBlockUsd = 0;
    for (const lease of leases.filter(isLeaseLive)) {
      const perBlockUsd = getLeasesCostPerBlockUsd([lease]);
      totalPerBlockUsd += perBlockUsd;
      perHourByDseq.set(lease.dseq, (perHourByDseq.get(lease.dseq) ?? 0) + perBlockToHourly(perBlockUsd));
    }

    return { perHourByDseq, spend: { perBlockUsd: totalPerBlockUsd, perHour: perBlockToHourly(totalPerBlockUsd) } };
  }, [leases]);

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

  const totalUsd = walletBalance?.totalUsd ?? 0;
  const reserved = deployments.reduce((sum, deployment) => sum + deployment.reservedUsd, 0);
  const available = Math.max(0, totalUsd - reserved);
  const hasSpend = spend.perBlockUsd > 0;
  const lastsUntil = hasSpend ? getTimeLeft(spend.perBlockUsd, totalUsd) : null;
  const autoReloadEnabled = walletSettings?.autoReloadEnabled ?? false;
  const isBalanceUnavailable = !balances && (isBalancesError || (!!address && balancesFetchStatus === "idle"));
  const autoReloadThreshold = isFixedThresholdEnabled && autoReloadEnabled ? walletSettings?.autoReloadThreshold ?? null : null;

  return {
    totalUsd,
    reserved,
    available,
    deployments,
    perHour: spend.perHour,
    lastsUntil,
    runwayDays: lastsUntil ? differenceInCalendarDays(lastsUntil, new Date()) : null,
    autoReloadEnabled,
    autoReloadThreshold,
    isLoading: !walletBalance && !isBalanceUnavailable,
    isError: isBalanceUnavailable
  };
}
