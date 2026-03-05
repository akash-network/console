import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";

export const useIsOnboarded = () => {
  const { user, isLoading: isUserLoading } = useUser();
  const { hasManagedWallet, isWalletConnected, isWalletLoading } = useWallet();

  return {
    isLoading: isUserLoading || isWalletLoading,
    canVisit: !user?.userId || hasManagedWallet || isWalletConnected
  };
};
