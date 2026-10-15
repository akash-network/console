import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useAccountDeletionEligibilityQuery } from "@src/queries/useAccountDeletionEligibilityQuery";
import { useBalances } from "@src/queries/useBalancesQuery";

export const DEPENDENCIES = { useWallet, useBalances, useWalletBalance, useFlag, useAccountDeletionEligibilityQuery };

/** The API rounds the balance to cents, so anything below one rounds to nothing to forfeit. */
const SMALLEST_FORFEITABLE_BALANCE_USD = 0.01;

export type TeamReference = { id: string; name: string };

export type AccountDeletionEligibility =
  | { status: "loading" }
  | { status: "blocked"; activeDeploymentCount: number; teamsWithDeployments: TeamReference[] }
  | { status: "transfer"; teamsToTransfer: TeamReference[] }
  | { status: "forfeit"; balanceUsd: number; teamsDeletedWithAccount: TeamReference[] }
  | { status: "clean"; teamsDeletedWithAccount: TeamReference[] };

type ServerEligibility = NonNullable<ReturnType<typeof useAccountDeletionEligibilityQuery>["data"]>;

/** With organizations on, the API tells which teams go with the account and which need a new owner; if it can't answer, the wallet still tells what the account alone forfeits. */
export function useAccountDeletionEligibility(dependencies: typeof DEPENDENCIES = DEPENDENCIES): AccountDeletionEligibility {
  const isOrganizationsEnabled = dependencies.useFlag("organizations");
  const serverEligibility = dependencies.useAccountDeletionEligibilityQuery({ enabled: isOrganizationsEnabled });
  const walletEligibility = useWalletEligibility(dependencies);

  if (!isOrganizationsEnabled || serverEligibility.isError) return walletEligibility;
  if (!serverEligibility.data) return { status: "loading" };

  return eligibilityFromServer(serverEligibility.data);
}

function useWalletEligibility(dependencies: typeof DEPENDENCIES): AccountDeletionEligibility {
  const { address, isTrialing } = dependencies.useWallet();
  const { data: balances, isLoading } = dependencies.useBalances(address);
  const { balance } = dependencies.useWalletBalance();

  if (isLoading) return { status: "loading" };

  const activeDeploymentCount = balances?.activeDeployments.length ?? 0;
  if (activeDeploymentCount > 0) return { status: "blocked", activeDeploymentCount, teamsWithDeployments: [] };

  const balanceUsd = isTrialing ? 0 : balance?.totalDeploymentGrantsUSD ?? 0;
  if (balanceUsd >= SMALLEST_FORFEITABLE_BALANCE_USD) return { status: "forfeit", balanceUsd, teamsDeletedWithAccount: [] };

  return { status: "clean", teamsDeletedWithAccount: [] };
}

function eligibilityFromServer({
  activeDeploymentCount,
  forfeitableBalanceUsd,
  teamsDeletedWithAccount,
  teamsToTransfer
}: ServerEligibility): AccountDeletionEligibility {
  const teams = teamsDeletedWithAccount.map(({ id, name }) => ({ id, name }));

  if (activeDeploymentCount > 0) {
    const teamsWithDeployments = teamsDeletedWithAccount.filter(team => team.activeDeploymentCount > 0).map(({ id, name }) => ({ id, name }));
    return { status: "blocked", activeDeploymentCount, teamsWithDeployments };
  }

  if (teamsToTransfer.length > 0) return { status: "transfer", teamsToTransfer };
  if (forfeitableBalanceUsd >= SMALLEST_FORFEITABLE_BALANCE_USD)
    return { status: "forfeit", balanceUsd: forfeitableBalanceUsd, teamsDeletedWithAccount: teams };

  return { status: "clean", teamsDeletedWithAccount: teams };
}
