"use client";
import { useCallback } from "react";
import { usePopup } from "@akashnetwork/ui/context";
import addHours from "date-fns/addHours";
import differenceInSeconds from "date-fns/differenceInSeconds";
import startOfHour from "date-fns/startOfHour";

import { useCurrencyFormatter } from "@src/hooks/useCurrencyFormatter/useCurrencyFormatter";
import { useDeploymentMetrics } from "@src/hooks/useDeploymentMetrics";
import { useDepositDeployment } from "@src/hooks/useDepositDeployment/useDepositDeployment";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { getEscrowDenom } from "@src/utils/deploymentUtils";
import { averageBlockTime } from "@src/utils/priceUtils";

export const DEPENDENCIES = {
  usePopup,
  useCurrencyFormatter,
  useDeploymentMetrics,
  useDepositDeployment,
  usePricing,
  useDeploymentSettingQuery
};

export interface UseAutoTopUpParams {
  deployment: DeploymentDto;
  leases: LeaseDto[] | null | undefined;
  onDeposited?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export interface UseAutoTopUpResult {
  isEnabled: boolean;
  isLoading: boolean;
  estimatedTopUpAmount: number;
  topUpFrequencyMs: number;
  realTimeLeft: ReturnType<typeof useDeploymentMetrics>["realTimeLeft"];
  setEnabled: (enabled: boolean) => Promise<void>;
  deposit: (amountUdenom: number) => Promise<boolean>;
}

/** The scheduled auto top-up job runs every 2 hours on the hour. */
const TOP_UP_CHECK_ANCHOR_HOURS = 2;

/**
 * Backs the per-deployment Auto Top-Up toggle and escrow "Add funds" action. Enabling auto top-up
 * requires the deployment to survive until the next scheduled check; when it wouldn't, the user is
 * asked to deposit the shortfall first, and the toggle is only flipped once that deposit succeeds.
 */
export function useAutoTopUp({ deployment, leases, onDeposited, dependencies: d = DEPENDENCIES }: UseAutoTopUpParams): UseAutoTopUpResult {
  const { confirm } = d.usePopup();
  const formatCurrency = d.useCurrencyFormatter();
  const { udenomToUsd } = d.usePricing();
  const deploymentSetting = d.useDeploymentSettingQuery({ dseq: deployment.dseq });
  const { realTimeLeft, deploymentCost } = d.useDeploymentMetrics({ deployment, leases });

  const escrowDenom = getEscrowDenom(deployment);
  const { deposit } = d.useDepositDeployment({ dseq: deployment.dseq, denom: escrowDenom, onSuccess: onDeposited });

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled && realTimeLeft?.timeLeft) {
        const secondsUntilNextTopUp = differenceInSeconds(addHours(startOfHour(new Date()), TOP_UP_CHECK_ANCHOR_HOURS), new Date());
        const secondsUntilClosed = differenceInSeconds(realTimeLeft.timeLeft, new Date());

        if (secondsUntilClosed < secondsUntilNextTopUp) {
          const secondsToDepositFor = secondsUntilNextTopUp - secondsUntilClosed;
          const requiredDeposit = Math.ceil((deploymentCost * secondsToDepositFor) / averageBlockTime);

          const isConfirmed = await confirm({
            title: "Deposit required",
            message: `To enable auto top-up, please deposit ${formatCurrency(udenomToUsd(requiredDeposit, escrowDenom))}. This ensures your deployment remains active until the next scheduled check.`
          });
          if (!isConfirmed) return;

          const deposited = await deposit(requiredDeposit);
          if (!deposited) return;
        }
      }

      deploymentSetting.setAutoTopUpEnabled(enabled);
    },
    [confirm, deploymentCost, deploymentSetting, deposit, escrowDenom, formatCurrency, realTimeLeft?.timeLeft, udenomToUsd]
  );

  return {
    isEnabled: deploymentSetting.data?.autoTopUpEnabled ?? false,
    isLoading: deploymentSetting.isLoading,
    estimatedTopUpAmount: deploymentSetting.data?.estimatedTopUpAmount ?? 0,
    topUpFrequencyMs: deploymentSetting.data?.topUpFrequencyMs ?? 0,
    realTimeLeft,
    setEnabled,
    deposit
  };
}
