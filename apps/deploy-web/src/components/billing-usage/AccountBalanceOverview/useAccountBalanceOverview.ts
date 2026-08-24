"use client";
import { useMemo } from "react";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";

import { useAutoReloadMode } from "@src/components/billing-usage/useAutoReloadMode";
import { useLocalNotes } from "@src/components/LocalNoteManager/useLocalNotes";
import { useWallet } from "@src/context/WalletProvider";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import type { LiveEscrowInput } from "@src/hooks/useWalletBalance";
import { computeWalletBalance } from "@src/hooks/useWalletBalance";
import { useWalletSettingsQuery } from "@src/queries";
import { useBalances } from "@src/queries/useBalancesQuery";
import { useBlock } from "@src/queries/useBlocksQuery";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { isLeaseLive, LIVE_LEASE_STATES } from "@src/utils/leaseUtils";
import { getLeaseCostPerBlockUsdByDseq, getLiveEscrowBalance, getTimeLeft, perBlockToHourly } from "@src/utils/priceUtils";

export const DEPENDENCIES = {
  useWallet,
  usePricing,
  useAutoReloadMode,
  useBalances,
  useAllLeases,
  useBlock,
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
  /** The auto-top-up trigger balance to mark on the bar, or null when no marker should render (prediction mode, auto-reload off, or unset). */
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
  const hasActiveDeployments = !!balances?.activeDeployments.length;
  /** Gated on the wallet holding an escrow: an account with nothing running shouldn't poll the chain every 30 seconds. */
  const { data: latestBlock } = d.useBlock("latest", { refetchInterval: 30000, enabled: hasActiveDeployments });
  const { data: walletSettings } = d.useWalletSettingsQuery();
  const { getDeploymentName } = d.useLocalNotes();
  const { showsThresholdRule } = d.useAutoReloadMode();

  const liveEscrow = useMemo<LiveEscrowInput>(
    () => ({
      latestBlockHeight: latestBlock ? Number(latestBlock.block.header.height) : undefined,
      perBlockUsdByDseq: getLeaseCostPerBlockUsdByDseq(leases?.filter(isLeaseLive) ?? [])
    }),
    [leases, latestBlock]
  );

  /** Not gated on the AKT market price: managed wallets hold ACT/USDC (1:1 USD), and blocking on market data would strand the card on its skeleton during an outage. */
  const walletBalance = useMemo(
    () => (balances ? computeWalletBalance(balances, price ?? 0, udenomToUsd, liveEscrow) : null),
    [balances, price, udenomToUsd, liveEscrow]
  );

  const spend = useMemo(() => {
    const perBlockUsd = [...liveEscrow.perBlockUsdByDseq.values()].reduce((total, deploymentPerBlockUsd) => total + deploymentPerBlockUsd, 0);

    return { perBlockUsd, perHour: perBlockToHourly(perBlockUsd) };
  }, [liveEscrow]);

  const deployments = useMemo<ReservedDeployment[]>(() => {
    if (!balances) return [];
    return balances.activeDeployments
      .map(deployment => {
        const pricePerBlock = liveEscrow.perBlockUsdByDseq.get(deployment.dseq) ?? 0;

        return {
          dseq: deployment.dseq,
          name: getDeploymentName(deployment.dseq) ?? `Deployment ${deployment.dseq}`,
          reservedUsd: getLiveEscrowBalance({
            settledBalance: deployment.escrowAccount.state.funds.reduce((sum, fund) => sum + udenomToUsd(fund.amount, fund.denom), 0),
            pricePerBlock,
            settledAt: Number(deployment.escrowAccount.state.settled_at),
            latestBlockHeight: liveEscrow.latestBlockHeight
          }),
          perHourUsd: perBlockToHourly(pricePerBlock)
        };
      })
      .sort((a, b) => b.reservedUsd - a.reservedUsd);
  }, [balances, getDeploymentName, udenomToUsd, liveEscrow]);

  const totalUsd = walletBalance?.totalUsd ?? 0;
  const reserved = deployments.reduce((sum, deployment) => sum + deployment.reservedUsd, 0);
  const available = Math.max(0, totalUsd - reserved);
  const hasSpend = spend.perBlockUsd > 0;
  const lastsUntil = hasSpend ? getTimeLeft(spend.perBlockUsd, totalUsd) : null;
  const autoReloadEnabled = walletSettings?.autoReloadEnabled ?? false;
  const isBalanceUnavailable = !balances && (isBalancesError || (!!address && balancesFetchStatus === "idle"));
  const autoReloadThreshold = showsThresholdRule && autoReloadEnabled ? walletSettings?.autoReloadThreshold ?? null : null;

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
