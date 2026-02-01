"use client";

import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { Loading } from "@src/components/layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

const EXCLUDED_PREFIXES = ["/signup", "/login", "/api/"];

export const OnboardingGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isLoading: isUserLoading } = useUser();
  const { hasManagedWallet, isWalletConnected, isWalletLoading } = useWallet();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isExcluded = EXCLUDED_PREFIXES.some(prefix => router.pathname.startsWith(prefix));

  useEffect(() => {
    if (isUserLoading || isWalletLoading || isExcluded) {
      return;
    }

    if (user?.userId && !hasManagedWallet && !isWalletConnected) {
      setIsRedirecting(true);
      router.replace(UrlService.onboarding({ returnTo: router.asPath }));
    }
  }, [isUserLoading, isWalletLoading, isExcluded, user?.userId, hasManagedWallet, isWalletConnected, router]);

  if (isRedirecting) {
    return <Loading text="Redirecting to onboarding..." />;
  }

  return <>{children}</>;
};
