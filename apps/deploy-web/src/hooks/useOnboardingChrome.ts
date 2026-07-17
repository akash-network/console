import { usePathname } from "next/navigation";

import { useWallet } from "@src/context/WalletProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";

export const DEPENDENCIES = { useWallet, usePathname, useAllLeases };

/**
 * Routes that get the stripped onboarding chrome. Matched with `startsWith`, so this
 * covers the `[[...dseq]]` variants of the configure route and excludes plain `/new-deployment`.
 */
export const ONBOARDING_CHROME_PATHS = ["/new-deployment/configure"];

export type OnboardingChromeState = {
  /** Render minimal chrome (no sidebar, logout-only menu, no WalletStatus). */
  isStripped: boolean;
};

/**
 * Single source of truth for whether the app chrome should be stripped for onboarding.
 * Only active on an onboarding route.
 *
 * "Onboarding" here means the user's *first* deployment — chrome is stripped only until they have a lease, the
 * same signal the onboarding gate uses (see `RequireOnboarding`). A trial user who has already deployed keeps the
 * full chrome when creating further deployments; trial status alone is not onboarding. The lease query is shared
 * (same key) with the gate, so it's usually cached and resolves without a spinner.
 */
export const useOnboardingChrome = (d: typeof DEPENDENCIES = DEPENDENCIES): OnboardingChromeState => {
  const { address, hasManagedWallet, managedWalletError } = d.useWallet();
  const pathname = d.usePathname();

  const isRelevant = !!pathname && ONBOARDING_CHROME_PATHS.some(path => pathname.startsWith(path));
  const hasWallet = hasManagedWallet && !!address;

  const leasesQuery = d.useAllLeases(address, { enabled: isRelevant && hasWallet });
  const isOnboarded = hasWallet && (leasesQuery.data?.length ?? 0) > 0;
  const leasesErrored = hasWallet && leasesQuery.isError;

  // A wallet error — or a leases error that leaves onboarding unknowable (an undefined result is not "no leases") —
  // makes the funnel decision unresolvable, so fail open to the full chrome rather than trap a possibly-onboarded
  // user in the stripped funnel. Mirrors the gate's fail-open on a transient chain-API blip.
  if (!isRelevant || managedWalletError || leasesErrored) {
    return { isStripped: false };
  }

  // Strip the chrome for the entire first-deploy funnel — including while the trial wallet is still provisioning and
  // its leases are loading — so the page can render its own progress UX (e.g. the auto-deploy overlay) instead of
  // being blanked behind Layout's full-screen spinner until the trial responds. We can't distinguish a brand-new
  // user from an already-onboarded one until leases settle, so we optimistically strip and let the full chrome fill
  // in if they turn out onboarded (leases are shared/cached in the normal in-app path, so that's rare) — a far
  // better trade than interrupting an in-progress deploy with a spinner.
  return { isStripped: !isOnboarded };
};
