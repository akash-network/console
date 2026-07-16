import { useWallet } from "@src/context/WalletProvider";
import { useOnboardingChrome } from "./useOnboardingChrome";
import { useUser } from "./useUser";

export const DEPENDENCIES = { useUser, useWallet, useOnboardingChrome };

/**
 * Whether to show the funding banner: a signed-in user still on the free trial (i.e. hasn't funded yet).
 * It hides once the trial converts to a funded account, and also inside the stripped onboarding deploy
 * funnel (the configure page for a first-time user), where the page owns its own funding / GPU-unlock
 * affordances. Isolating the trial read here keeps the "unfunded" signal in one place to swap when the
 * wallet provider is retired.
 */
export function useHasFundingBanner(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { user } = dependencies.useUser();
  const { isTrialing, isWalletLoading } = dependencies.useWallet();
  const { isStripped } = dependencies.useOnboardingChrome();

  return !!user?.id && !isWalletLoading && isTrialing && !isStripped;
}
