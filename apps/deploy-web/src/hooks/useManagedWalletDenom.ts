import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";

export const useManagedWalletDenom = () => {
  const { publicConfig } = useServices();
  const wallet = useWallet();
  const usdcDenom = useUsdcDenom();

  return wallet.isManaged && publicConfig.NEXT_PUBLIC_MANAGED_WALLET_DENOM === "usdc" ? usdcDenom : "uakt";
};
