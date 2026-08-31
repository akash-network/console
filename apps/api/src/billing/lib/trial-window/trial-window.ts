import addDays from "date-fns/addDays";

import type { UserWalletOutput } from "@src/billing/repositories/user-wallet/user-wallet.repository";

type TrialWindowWallet = Pick<UserWalletOutput, "activatedAt" | "createdAt">;

/** A wallet created before the trial activation job ran starts its trial only once activated. */
export function getTrialStartedAt(wallet: TrialWindowWallet): Date {
  return wallet.activatedAt ?? wallet.createdAt;
}

export function getTrialEndsAt(wallet: TrialWindowWallet, trialDurationDays: number): Date {
  return addDays(getTrialStartedAt(wallet), trialDurationDays);
}
