import { useWallet } from "@src/context/WalletProvider";

export const DEPENDENCIES = { useWallet };

/**
 * Whether managed-wallet trial restrictions apply on the configure screen: a trial user — or one whose
 * wallet hasn't provisioned yet (`isTrialing || !isWalletReady`) — is subject to the trial's limits.
 * Readiness is read as `hasManagedWallet` (a pure context read) rather than the side-effectful
 * `useEnsureTrialStarted`, since the trial is already provisioned once by the `DeploymentFlowProvider`
 * on this screen. What a restriction actually blocks (e.g. specific GPU models) is decided by the consumer.
 */
export function useTrialGate(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { isTrialing, hasManagedWallet } = dependencies.useWallet();
  return { isRestricted: isTrialing || !hasManagedWallet, isWalletReady: hasManagedWallet };
}
