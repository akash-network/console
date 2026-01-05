import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";

import { useWallet } from "@src/context/WalletProvider";
import walletStore from "@src/store/walletStore";
import { useUser } from "./useUser";

export function useHasCreditCardBanner() {
  const { user } = useUser();
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { hasManagedWallet, isWalletLoading } = useWallet();
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const shouldShowBanner = useMemo(
    () => isInitialized && !hasManagedWallet && !isWalletLoading && !isSignedInWithTrial,
    [isInitialized, hasManagedWallet, isWalletLoading, isSignedInWithTrial]
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
