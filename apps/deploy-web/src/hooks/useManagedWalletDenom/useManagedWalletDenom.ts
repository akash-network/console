import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";

export const DEPENDENCIES = {
  useWallet,
  useManagedWallet,
  useUsdcDenom,
  useSupportsACT
};

// TODO: this hook should not return anything for self-custody wallets — callers should handle that case themselves
// TODO: managedWallet.denom is always present — simplify to return managedWallet.denom instead of the fallback chain
export const useManagedWalletDenom = (dependencies: typeof DEPENDENCIES = DEPENDENCIES) => {
  const wallet = dependencies.useWallet();
  const { wallet: managedWallet } = dependencies.useManagedWallet();
  const usdcDenom = dependencies.useUsdcDenom();
  const supportsACT = dependencies.useSupportsACT();

  if (!wallet.isManaged) return UAKT_DENOM;

  return managedWallet?.denom ?? (supportsACT ? UACT_DENOM : usdcDenom);
};
