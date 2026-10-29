"use client";
import { useTrialStatus } from "@src/components/billing-usage/TrialStatusPanel/useTrialStatus";
import { useWallet } from "@src/context/WalletProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDeploymentFundingConfigQuery } from "@src/queries/useDeploymentFundingConfigQuery";
import { useFeeAllowanceExistenceQuery } from "@src/queries/useFeeAllowanceQuery";

export const DEPENDENCIES = {
  useWallet,
  useTrialStatus,
  useWalletBalance,
  useDeploymentFundingConfigQuery,
  useFeeAllowanceExistenceQuery
};

/** A trial still being provisioned is empty on chain too, so an open trial only counts once its fee allowance shows the grants landed. */
export function useIsOutOfDeployCredit({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): boolean {
  const { address, isTrialing } = d.useWallet();
  const { isExpired: isTrialExpired } = d.useTrialStatus();
  const { balance } = d.useWalletBalance();
  const { data: fundingConfig } = d.useDeploymentFundingConfigQuery();
  const isBelowOpeningDeposit = !!balance && !!fundingConfig && balance.totalDeploymentGrantsUSD < fundingConfig.defaultDepositUsd;
  const isTrialOpen = isTrialing && !isTrialExpired;
  const { data: hasFeeAllowance } = d.useFeeAllowanceExistenceQuery(address, { enabled: isBelowOpeningDeposit && isTrialOpen });

  return isBelowOpeningDeposit && (!isTrialOpen || hasFeeAllowance === true);
}
