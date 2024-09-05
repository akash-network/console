import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";

export const useManagedWalletDenom = () => {
  const wallet = useWallet();
  const usdcDenom = useUsdcDenom();

  return wallet.isManaged && browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_DENOM === "usdc" ? usdcDenom : "uakt";
};
