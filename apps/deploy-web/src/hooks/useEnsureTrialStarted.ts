import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";

import { useManagedWallet } from "@src/hooks/useManagedWallet";

export const DEPENDENCIES = {
  useManagedWallet
};

export type EnsureTrialStartedResult = {
  wallet: ApiManagedWalletOutput | undefined;
  isWalletReady: boolean;
  isLoading: boolean;
};

/**
 * Reports the managed (trial) wallet and whether it exists yet. The trial is provisioned server-side by a background
 * job (triggered when the user registers/verifies), so there is nothing to start from the client — this only reports
 * readiness. `isWalletReady` means the wallet exists and can broadcast; whether it can actually *spend* (the trial is
 * activated on chain) is enforced by the API, which returns a retriable `wallet_provisioning` 409 on the spend until
 * activation lands.
 */
export const useEnsureTrialStarted = (d = DEPENDENCIES): EnsureTrialStartedResult => {
  const { wallet, isInitializing } = d.useManagedWallet();

  return { isWalletReady: !!wallet?.address, isLoading: isInitializing, wallet: wallet as ApiManagedWalletOutput | undefined };
};
