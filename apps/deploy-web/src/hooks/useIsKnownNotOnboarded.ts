import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { useLeaseExistenceQuery } from "@src/queries/useLeaseQuery";

export const DEPENDENCIES = { useWallet, useUser, useLeaseExistenceQuery, useActiveOrganization };

/** Stays false until the onboarding gate's inputs have settled, so a control that sends the user into onboarding never acts on an answer still loading. */
export function useIsKnownNotOnboarded(d: typeof DEPENDENCIES = DEPENDENCIES): boolean {
  const { address, hasWallet } = d.useWallet();
  const { user, isLoading: isUserLoading } = d.useUser();
  const { activeOrganization, isLoading: isOrganizationLoading, isError: organizationsErrored } = d.useActiveOrganization();

  const hasWalletAddress = hasWallet && !!address;
  const leaseExistenceQuery = d.useLeaseExistenceQuery(address, { enabled: hasWalletAddress, refetchOnMount: false });

  if (isUserLoading || isOrganizationLoading || organizationsErrored || !user?.userId) return false;
  if (user.onboardingSkippedAt || activeOrganization?.type === "team") return false;
  return !hasWalletAddress || leaseExistenceQuery.data === false;
}
