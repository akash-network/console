import { envConfig } from "@src/config/env.config";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";

export const useManagedWalletDenom = () => {
  const wallet = useWallet();
  const usdcDenom = useUsdcDenom();

  return wallet.isManaged && envConfig.NEXT_PUBLIC_MANAGED_WALLET_DENOM === "usdc" ? usdcDenom : "uakt";
};
