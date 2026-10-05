import { useWallet } from "@src/context/WalletProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useBalances } from "@src/queries/useBalancesQuery";

export const DEPENDENCIES = { useWallet, useBalances, useWalletBalance };

/** The API rounds the balance to cents, so anything below one rounds to nothing to forfeit. */
const SMALLEST_FORFEITABLE_BALANCE_USD = 0.01;

export type AccountDeletionEligibility =
  | { status: "loading" }
  | { status: "blocked"; activeDeploymentCount: number }
  | { status: "forfeit"; balanceUsd: number }
  | { status: "clean" };

export function useAccountDeletionEligibility(dependencies: typeof DEPENDENCIES = DEPENDENCIES): AccountDeletionEligibility {
  const { address, isTrialing } = dependencies.useWallet();
  const { data: balances, isLoading } = dependencies.useBalances(address);
  const { balance } = dependencies.useWalletBalance();

  if (isLoading) return { status: "loading" };

  const activeDeploymentCount = balances?.activeDeployments.length ?? 0;
  if (activeDeploymentCount > 0) return { status: "blocked", activeDeploymentCount };

  const balanceUsd = isTrialing ? 0 : balance?.totalDeploymentGrantsUSD ?? 0;
  if (balanceUsd >= SMALLEST_FORFEITABLE_BALANCE_USD) return { status: "forfeit", balanceUsd };

  return { status: "clean" };
}
