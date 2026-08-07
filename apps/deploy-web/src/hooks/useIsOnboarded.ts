import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { useLeaseExistenceQuery } from "@src/queries/useLeaseQuery";

export const DEPENDENCIES = { useWallet, useUser, useLeaseExistenceQuery };

/**
 * Whether the user has finished onboarding: they own a managed wallet with at least one lease (their first deployment)
 * or have explicitly skipped. Shares the lease-existence query key with the always-mounted onboarding gate (see
 * `RequireOnboarding`), which keeps it fresh; `refetchOnMount: false` stops this extra observer from re-firing the
 * request on every mount while the answer is `false` (a `false` answer is kept permanently stale by design).
 * While the query is unresolved or errored this returns `false`, unlike the gate's fail-open: consumers hide
 * affordances such as links into gated routes, where wrongly hiding is harmless but wrongly showing dead-ends.
 */
export function useIsOnboarded(d: typeof DEPENDENCIES = DEPENDENCIES): boolean {
  const { address, hasWallet } = d.useWallet();
  const { user } = d.useUser();

  const hasWalletAddress = hasWallet && !!address;
  const leaseExistenceQuery = d.useLeaseExistenceQuery(address, { enabled: hasWalletAddress, refetchOnMount: false });
  const isOnboarded = hasWalletAddress && !!leaseExistenceQuery.data;
  const hasSkippedOnboarding = !!user?.onboardingSkippedAt;

  return isOnboarded || hasSkippedOnboarding;
}
