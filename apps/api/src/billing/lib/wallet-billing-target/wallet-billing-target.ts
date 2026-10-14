/** Whose auto reload and credit warnings a job covers: a user's own wallet, keyed by its user as before teams paid, or a team's wallet, keyed by its id. */
export type WalletBillingTarget = { userId: string } | { walletId: number };

export function walletBillingTargetOf(wallet: { id: number; userId: string | null }): WalletBillingTarget {
  return wallet.userId ? { userId: wallet.userId } : { walletId: wallet.id };
}

export function singletonKeyOf(jobName: string, target: WalletBillingTarget): string {
  return "userId" in target ? `${jobName}.${target.userId}` : `${jobName}.wallet.${target.walletId}`;
}

/** Drops whatever else a job payload carries, so logs and keys see the target alone. */
export function pickWalletBillingTarget(data: WalletBillingTarget): WalletBillingTarget {
  return "userId" in data ? { userId: data.userId } : { walletId: data.walletId };
}
