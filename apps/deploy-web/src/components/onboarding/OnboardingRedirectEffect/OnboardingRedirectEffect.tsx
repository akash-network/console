import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import onboardingStore from "@src/store/onboardingStore";
import { UrlService } from "@src/utils/urlUtils";

export const EXCLUDED_PREFIXES = ["/signup", "/onboarding", "/login", "/api/", "/user/verify-email"];

const useSelectedOnboardingFlow = () => useAtomValue(onboardingStore.selectedOnboardingFlow);

const DEPENDENCIES = {
  useUser,
  useWallet,
  useRouter,
  useFlag,
  useSelectedOnboardingFlow,
  UrlService
};

type OnboardingRedirectEffectProps = {
  dependencies?: typeof DEPENDENCIES;
};

export const OnboardingRedirectEffect = ({ dependencies: d = DEPENDENCIES }: OnboardingRedirectEffectProps) => {
  const { user, isLoading: isUserLoading } = d.useUser();
  const { hasManagedWallet, isWalletConnected, isWalletLoading } = d.useWallet();
  const selectedOnboardingFlow = d.useSelectedOnboardingFlow();
  const isOnboardingRedesignEnabled = d.useFlag("console_onboarding_redesign");
  const router = d.useRouter();

  useEffect(() => {
    const isExcluded = EXCLUDED_PREFIXES.some(prefix => router.pathname.startsWith(prefix));

    if (isExcluded || isUserLoading || isWalletLoading) {
      return;
    }

    if (user?.userId && !hasManagedWallet && !isWalletConnected) {
      const isRedesign = isOnboardingRedesignEnabled && selectedOnboardingFlow === "redesign";
      const destination = isRedesign ? d.UrlService.onboardingPicker() : d.UrlService.onboarding({ returnTo: router.asPath });
      router.replace(destination);
    }
  }, [
    isUserLoading,
    isWalletLoading,
    user?.userId,
    hasManagedWallet,
    isWalletConnected,
    isOnboardingRedesignEnabled,
    selectedOnboardingFlow,
    router,
    d.UrlService
  ]);

  return null;
};
