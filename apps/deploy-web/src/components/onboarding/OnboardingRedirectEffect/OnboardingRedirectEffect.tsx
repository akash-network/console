import { useEffect } from "react";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

const EXCLUDED_PREFIXES = ["/signup", "/login", "/api/"];

export const OnboardingRedirectEffect = () => {
  const { user, isLoading: isUserLoading } = useUser();
  const { hasManagedWallet, isWalletConnected, isWalletLoading } = useWallet();
  const router = useRouter();

  useEffect(() => {
    const isExcluded = EXCLUDED_PREFIXES.some(prefix => router.pathname.startsWith(prefix));

    if (isExcluded || isUserLoading || isWalletLoading) {
      return;
    }

    if (user?.userId && !hasManagedWallet && !isWalletConnected) {
      router.replace(UrlService.onboarding({ returnTo: router.asPath }));
    }
  }, [isUserLoading, isWalletLoading, user?.userId, hasManagedWallet, isWalletConnected, router]);

  return null;
};
