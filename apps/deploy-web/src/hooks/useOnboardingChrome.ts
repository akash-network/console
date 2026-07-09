import { usePathname } from "next/navigation";

import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";

export const DEPENDENCIES = { useWallet, usePathname, useFlag };

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
 * `isResolving` covers both the wallet-query load and the brief trial-provisioning window.
 */
export const useOnboardingChrome = (d: typeof DEPENDENCIES = DEPENDENCIES): OnboardingChromeState => {
  const { isOnboarding, isWalletLoading, hasManagedWallet, managedWalletError } = d.useWallet();
  const pathname = d.usePathname();
  const isRedesignEnabled = d.useFlag("onboarding_redesign_v1");

  const isRelevant = isRedesignEnabled && !!pathname && ONBOARDING_CHROME_PATHS.some(path => pathname.startsWith(path));

  return {
    isStripped: isRelevant && isOnboarding,
    isResolving: isRelevant && !isOnboarding && !managedWalletError && (isWalletLoading || !hasManagedWallet)
  };
};
