import { useEffect, useMemo, useState } from "react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "./useUser";
import { useAtom } from "jotai";
import walletStore from "@src/store/walletStore";

const withBilling = browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;

export function useHasCreditCardBanner() {
  const user = useUser();
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { hasManagedWallet, isWalletLoading } = useWallet();
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const shouldShowBanner = useMemo(
    () => isInitialized && withBilling && !hasManagedWallet && !isWalletLoading && !isSignedInWithTrial,
    [isInitialized, hasManagedWallet, isWalletLoading]
  );

  useEffect(() => {
    if (user?.id) {
      setIsInitialized(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (shouldShowBanner) {
      setIsBannerVisible(true);
    }
  }, [shouldShowBanner]);

  return isBannerVisible;
}
