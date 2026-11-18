"use client";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDeploymentFundingConfigQuery } from "@src/queries/useDeploymentFundingConfigQuery";

export const DEPENDENCIES = {
  useWalletBalance,
  useDeploymentFundingConfigQuery
};

/** Answers no while the balance or the deposit is unknown, so a caller that deploys on its answer never starts a deploy the api refuses for funds. */
export function useCoversOpeningDeposit({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): boolean {
  const { balance } = d.useWalletBalance();
  const { data: fundingConfig } = d.useDeploymentFundingConfigQuery();

  return !!balance && !!fundingConfig && balance.totalDeploymentGrantsUSD >= fundingConfig.defaultDepositUsd;
}
