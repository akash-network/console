"use client";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedWallet } from "@src/hooks/useManagedWallet";

export const DEPENDENCIES = {
  useWallet,
  useManagedWallet,
  useServices
};

export type TrialStatus = {
  isTrialing: boolean;
  totalDays: number;
  /** null until the API reports an expiry, which keeps the panel from guessing a countdown it doesn't know. */
  daysLeft: number | null;
  /** Drains as the trial runs down: full on day one, empty once it expires. */
  daysRemainingPercent: number;
  isExpired: boolean;
  deploymentDurationHours: number;
};

export function useTrialStatus({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): TrialStatus {
  const { isTrialing } = d.useWallet();
  const { wallet } = d.useManagedWallet();
  const { publicConfig } = d.useServices();

  const totalDays = publicConfig.NEXT_PUBLIC_TRIAL_DURATION_DAYS;
  const trialEndsAt = wallet?.trialEndsAt ? new Date(wallet.trialEndsAt) : null;
  const daysLeft = trialEndsAt ? Math.min(Math.max(differenceInCalendarDays(trialEndsAt, new Date()), 0), totalDays) : null;

  return {
    isTrialing,
    totalDays,
    daysLeft,
    daysRemainingPercent: daysLeft === null ? 100 : (daysLeft / totalDays) * 100,
    isExpired: daysLeft === 0,
    deploymentDurationHours: publicConfig.NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS
  };
}
