import { useEffect, useMemo } from "react";
import { useAtom } from "jotai";

import { UACT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import { useBalances } from "@src/queries/useBalancesQuery";
import { useBlock } from "@src/queries/useBlocksQuery";
import { useSpendRateQuery } from "@src/queries/useSpendRateQuery";
import walletStore from "@src/store/walletStore";
import type { Balances } from "@src/types";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getLiveEscrowBalance, uaktToAKT } from "@src/utils/priceUtils";
import type { PricingContext } from "./usePricing/usePricing";
import { usePricing } from "./usePricing/usePricing";

export type WalletBalance = {
  totalUsd: number;
  balanceUAKT: number;
  balanceUUSDC: number;
  balanceUACT: number;
  totalUAKT: number;
  totalUUSDC: number;
  totalUACT: number;
  totalDeploymentEscrowUAKT: number;
  totalDeploymentEscrowUUSDC: number;
  totalDeploymentEscrowUACT: number;
  totalDeploymentEscrowUSD: number;
  totalDeploymentGrantsUAKT: number;
  totalDeploymentGrantsUUSDC: number;
  totalDeploymentGrantsUACT: number;
  totalDeploymentGrantsUSD: number;
};

export type WalletBalanceReturnType = {
  isLoading: boolean;
  refetch: () => void;
  balance: WalletBalance | null;
};

/**
 * The live per-block USD burn of every deployment, alongside the height to measure it from. Without it the
 * escrow totals read back the chain's settled figures, which sit high until the escrow next settles.
 */
export type LiveEscrowInput = {
  latestBlockHeight?: number;
  perBlockUsdByDseq: Map<string, number>;
};

/** Converts on-chain balances into USD totals; shared by the wallet-balance atom and callers needing the same figures synchronously. */
export function computeWalletBalance(
  balances: Balances,
  price: number,
  udenomToUsd: PricingContext["udenomToUsd"],
  liveEscrow?: LiveEscrowInput
): WalletBalance {
  const aktUsdValue = uaktToAKT(balances.balanceUAKT, 6) * price;
  const totalUsdcValue = udenomToDenom(balances.balanceUUSDC, 6);
  const totalDeploymentEscrowUSD = balances.activeDeployments.reduce(
    (acc, d) =>
      acc +
      getLiveEscrowBalance({
        settledBalance: d.escrowAccount.state.funds.reduce((fundAcc, fund) => fundAcc + udenomToUsd(fund.amount, fund.denom), 0),
        pricePerBlock: liveEscrow?.perBlockUsdByDseq.get(d.dseq) ?? 0,
        settledAt: Number(d.escrowAccount.state.settled_at),
        latestBlockHeight: liveEscrow?.latestBlockHeight
      }),
    0
  );
  const { deploymentGrants } = balances;
  const totalDeploymentGrantsUSD = deploymentGrants.reduce(
    (sum, grant) => sum + grant.authorization.spend_limits.reduce((grantSum, spendLimit) => grantSum + udenomToUsd(spendLimit.amount, spendLimit.denom), 0),
    0
  );

  return {
    totalUsd: aktUsdValue + totalUsdcValue + udenomToUsd(balances.balanceUACT, UACT_DENOM) + totalDeploymentEscrowUSD + totalDeploymentGrantsUSD,
    balanceUAKT: balances.balanceUAKT + balances.deploymentGrantsUAKT,
    balanceUUSDC: balances.balanceUUSDC + balances.deploymentGrantsUUSDC,
    balanceUACT: balances.balanceUACT + balances.deploymentGrantsUACT,
    totalUAKT: balances.balanceUAKT + balances.deploymentEscrowUAKT + balances.deploymentGrantsUAKT,
    totalUUSDC: balances.balanceUUSDC + balances.deploymentEscrowUUSDC + balances.deploymentGrantsUUSDC,
    totalUACT: balances.balanceUACT + balances.deploymentEscrowUACT + balances.deploymentGrantsUACT,
    totalDeploymentEscrowUAKT: balances.deploymentEscrowUAKT,
    totalDeploymentEscrowUUSDC: balances.deploymentEscrowUUSDC,
    totalDeploymentEscrowUACT: balances.deploymentEscrowUACT,
    totalDeploymentEscrowUSD: totalDeploymentEscrowUSD,
    totalDeploymentGrantsUAKT: balances.deploymentGrantsUAKT,
    totalDeploymentGrantsUUSDC: balances.deploymentGrantsUUSDC,
    totalDeploymentGrantsUACT: balances.deploymentGrantsUACT,
    totalDeploymentGrantsUSD: totalDeploymentGrantsUSD
  };
}

export const useWalletBalance = (): WalletBalanceReturnType => {
  const { price, udenomToUsd } = usePricing();
  const { address } = useWallet();
  const { data: balances, isFetching: isLoadingBalances, refetch } = useBalances(address);
  const [walletBalance, setWalletBalance] = useAtom(walletStore.balance);
  const liveEscrow = useLiveEscrow(address, balances);

  useEffect(
    function publishBalanceWhenLoaded() {
      if (balances) {
        setWalletBalance(computeWalletBalance(balances, price ?? 0, udenomToUsd, liveEscrow));
      }
    },
    [price, balances, udenomToUsd, liveEscrow]
  );

  return {
    balance: walletBalance,
    isLoading: isLoadingBalances,
    refetch
  };
};

export const LIVE_ESCROW_DEPENDENCIES = { useSpendRateQuery, useBlock };

/**
 * Both queries are gated on the wallet actually holding an escrow, so an account with nothing running pays
 * for neither: `useWalletBalance` is mounted app-wide through `PaymentPollingProvider`.
 */
export function useLiveEscrow(
  address: string,
  balances: Balances | null | undefined,
  d: typeof LIVE_ESCROW_DEPENDENCIES = LIVE_ESCROW_DEPENDENCIES
): LiveEscrowInput {
  const hasActiveDeployments = !!balances?.activeDeployments.length;
  const { data: perBlockUsdByDseq } = d.useSpendRateQuery({ enabled: !!address && hasActiveDeployments });
  const { data: latestBlock } = d.useBlock("latest", { refetchInterval: 30000, enabled: hasActiveDeployments });

  return useMemo(
    () => ({
      latestBlockHeight: latestBlock ? Number(latestBlock.block.header.height) : undefined,
      perBlockUsdByDseq: perBlockUsdByDseq ?? new Map()
    }),
    [perBlockUsdByDseq, latestBlock]
  );
}
