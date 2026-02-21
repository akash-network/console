import { useEffect } from "react";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

export const EXCLUDED_PREFIXES = ["/signup", "/login", "/api/", "/user/verify-email"];

const DEPENDENCIES = {
  useUser,
  useWallet,
  useRouter,
  UrlService
};

type OnboardingRedirectEffectProps = {
  dependencies?: typeof DEPENDENCIES;
};

export const OnboardingRedirectEffect = ({ dependencies: d = DEPENDENCIES }: OnboardingRedirectEffectProps) => {
  const { user, isLoading: isUserLoading } = d.useUser();
  const { hasManagedWallet, isWalletConnected, isWalletLoading } = d.useWallet();
  const router = d.useRouter();

  useEffect(() => {
    const isExcluded = EXCLUDED_PREFIXES.some(prefix => router.pathname.startsWith(prefix));

    if (isExcluded || isUserLoading || isWalletLoading) {
      return;
    }

    if (user?.userId && !hasManagedWallet && !isWalletConnected) {
      router.replace(d.UrlService.onboarding({ returnTo: router.asPath }));
    }
  }, [isUserLoading, isWalletLoading, user?.userId, hasManagedWallet, isWalletConnected, router, d.UrlService]);

  return null;
};
