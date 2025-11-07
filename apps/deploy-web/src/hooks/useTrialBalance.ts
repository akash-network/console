import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedWallet } from "./useManagedWallet";
import { useWalletBalance } from "./useWalletBalance";

export type TrialBalance = {
  total: number;
  remaining: number;
  used: number;
  usagePercentage: number;
  isLoading: boolean;
  trialEndDate: Date;
  daysRemaining: number;
};

export const useTrialBalance = (): TrialBalance => {
  const { creditAmount } = useWallet();
  const { balance: walletBalance, isLoading } = useWalletBalance();
  const { wallet: managedWallet } = useManagedWallet();
  const { appConfig } = useServices();

  const TRIAL_TOTAL = appConfig.NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT;
  const TRIAL_DURATION_DAYS = appConfig.NEXT_PUBLIC_TRIAL_DURATION_DAYS;

  const creditsRemaining = Math.min(Math.max(walletBalance?.totalDeploymentGrantsUSD ?? creditAmount ?? TRIAL_TOTAL, 0), TRIAL_TOTAL);
  const creditsUsed = TRIAL_TOTAL - creditsRemaining;
  const usagePercentage = Math.min(Math.max((creditsUsed / TRIAL_TOTAL) * 100, 0), 100);

  // Calculate trial end date from wallet creation date
  const now = new Date();
  let trialEndDate = new Date(now);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

  let timeRemaining = trialEndDate.getTime() - now.getTime();
  let daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));

  if (managedWallet?.createdAt) {
    const createdAt = new Date(managedWallet.createdAt);
    trialEndDate = new Date(createdAt);
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

    timeRemaining = trialEndDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
  }

  return {
    total: TRIAL_TOTAL,
    remaining: creditsRemaining,
    used: creditsUsed,
    usagePercentage,
    isLoading,
    trialEndDate,
    daysRemaining
  };
};
