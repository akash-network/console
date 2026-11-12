import { useManagedWallet } from "./useManagedWallet";

export const DEPENDENCIES = { useManagedWallet };

export function useHasTrialRefusedBanner(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { wallet } = dependencies.useManagedWallet();

  return !!wallet?.isTrialRefused;
}
