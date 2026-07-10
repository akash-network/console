import { usePathname } from "next/navigation";

import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useAllLeases } from "@src/queries/useLeaseQuery";

export const DEPENDENCIES = { useWallet, usePathname, useFlag, useAllLeases };

/**
 * Routes that get the stripped onboarding chrome. Matched with `startsWith`, so this
 * covers the `[[...dseq]]` variants of the configure route and excludes plain `/new-deployment`.
 */
export const ONBOARDING_CHROME_PATHS = ["/new-deployment/configure"];

export type OnboardingChromeState = {
  /** Render minimal chrome (no sidebar, logout-only menu, no WalletStatus). */
  isStripped: boolean;
  /** Onboarding state not yet known; hold with a neutral spinner to avoid a chrome flash either way. */
  isResolving: boolean;
};

/**
 * Single source of truth for whether the app chrome should be stripped for onboarding.
 * Ships fully dark: only active behind `onboarding_redesign_v1` on an onboarding route.
 *
 * "Onboarding" here means the user's *first* deployment — chrome is stripped only until they have a lease, the
 * same signal the onboarding gate uses (see `RequireOnboarding`). A trial user who has already deployed keeps the
 * full chrome when creating further deployments; trial status alone is not onboarding. The lease query is shared
 * (same key) with the gate, so it's usually cached and resolves without a spinner.
 */
export const useOnboardingChrome = (d: typeof DEPENDENCIES = DEPENDENCIES): OnboardingChromeState => {
  const { address, hasManagedWallet, isWalletLoading, managedWalletError } = d.useWallet();
  const pathname = d.usePathname();
  const isRedesignEnabled = d.useFlag("onboarding_redesign_v1");

  const isRelevant = isRedesignEnabled && !!pathname && ONBOARDING_CHROME_PATHS.some(path => pathname.startsWith(path));
  const hasWallet = hasManagedWallet && !!address;

  const leasesQuery = d.useAllLeases(address, { enabled: isRelevant && hasWallet });
  const isLeasesLoading = hasWallet && leasesQuery.isLoading;
  const isOnboarded = hasWallet && (leasesQuery.data?.length ?? 0) > 0;

  // A wallet error leaves onboarding unknowable, so fail open to the full chrome rather than trap the user in the
  // stripped funnel — mirrors the gate's fail-open on a transient chain-API blip.
  if (!isRelevant || managedWalletError) {
    return { isStripped: false, isResolving: false };
  }

  // The trial wallet is still provisioning/loading, or its leases haven't settled: hold either way to avoid a flash.
  const isResolving = isWalletLoading || !hasWallet || isLeasesLoading;

  return {
    isStripped: !isResolving && !isOnboarded,
    isResolving
  };
};
