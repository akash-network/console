import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useManagedWallet } from "@src/hooks/useManagedWallet";

export const useManagedWalletDenom = () => {
  const wallet = useWallet();
  const { wallet: managedWallet } = useManagedWallet();
  const usdcDenom = useUsdcDenom();

  if (!wallet.isManaged) return "uakt";

  return managedWallet?.denom ?? usdcDenom;
};
