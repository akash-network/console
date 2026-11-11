import { type DepositShortfall, formatUsd } from "../depositShortfall/depositShortfall";

export type NeedsFundsVariant =
  | { name: "trial_credit_used_up" }
  | { name: "trial_credit_below_minimum"; availableAmountUsd: number; minimumDepositUsd: number }
  | { name: "not_enough_balance" };

type VariantInput = {
  isTrialing: boolean;
  availableAmountUsd?: number;
  minimumDepositUsd?: number;
};

export function needsFundsVariantOf({ isTrialing, availableAmountUsd, minimumDepositUsd }: VariantInput): NeedsFundsVariant {
  if (!isTrialing || availableAmountUsd === undefined) return { name: "not_enough_balance" };
  if (displaysAsNoCredit(availableAmountUsd)) return { name: "trial_credit_used_up" };
  if (minimumDepositUsd !== undefined && availableAmountUsd < minimumDepositUsd) {
    return { name: "trial_credit_below_minimum", availableAmountUsd, minimumDepositUsd };
  }
  return { name: "not_enough_balance" };
}

function displaysAsNoCredit(amountUsd: number): boolean {
  return formatUsd(Math.max(amountUsd, 0)) === formatUsd(0);
}

/** Only a refusal that reported its amounts can tell when the balance has grown enough, so one without them never offers a retry. */
export function canRetryRefusedDeploy({ shortfall, balanceUsd }: { shortfall?: DepositShortfall; balanceUsd?: number }): boolean {
  return !!shortfall && balanceUsd !== undefined && balanceUsd >= shortfall.requiredAmountUsd;
}
