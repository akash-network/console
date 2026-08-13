import type { balanceChangeReason } from "@src/db/schema";
import type { ModuleAddressRegistry } from "@src/pipeline/balance/module-address-registry";

export type BalanceReason = (typeof balanceChangeReason.enumValues)[number];

/** What the classifier knows about one coin movement: who moved it, the correlated counterparty, whether it credits the holder, and any coincident mint/burn/slash. */
export interface ReasonContext {
  address: string;
  counterpartyAddress: string | null;
  denom: string;
  isMint: boolean;
  isBurn: boolean;
  isSlash: boolean;
  isCredit: boolean;
  msgTypeUrl: string | null;
}

const WITHDRAW_VALIDATOR_COMMISSION = "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission";

/**
 * Reason heuristic. Coincident mint/burn/slash win first (they are unambiguous), then the holder's own module
 * role, falling back to the counterparty's, then the denom. Preferring the holder's own role keeps each leg of
 * a module-to-module movement (e.g. fee_collector to distribution every block) tagged by the module whose
 * balance actually changed, rather than mirroring the counterparty. Distribution flows are direction-aware
 * relative to the module so a fund-community-pool inflow is not mistaken for a reward. Anything unrecognized is
 * a plain `transfer`. Escrow-module movements classify as `escrow`; per-deployment/lease attribution of that
 * escrow is deliberately left for later.
 */
export function classifyReason(ctx: ReasonContext, registry: ModuleAddressRegistry): BalanceReason {
  if (ctx.isSlash) {
    return "slash";
  }
  if (ctx.isMint) {
    return "mint";
  }
  if (ctx.isBurn) {
    return "burn";
  }

  const holderRole = registry.roleOf(ctx.address);
  const role = holderRole ?? (ctx.counterpartyAddress ? registry.roleOf(ctx.counterpartyAddress) : undefined);
  switch (role) {
    case "mint":
      return "mint";
    case "fee_collector":
      return "fee";
    case "distribution":
      return classifyDistributionFlow(ctx, holderRole === "distribution");
    case "bonded_tokens_pool":
    case "not_bonded_tokens_pool":
      return "staking";
    case "gov":
      return "gov";
    case "ibc_transfer":
      return "ibc";
    case "escrow":
      return "escrow";
    case "bme_vault":
      return "bme";
  }

  return ctx.denom.startsWith("ibc/") ? "ibc" : "transfer";
}

/**
 * A payout leaving the distribution module is a delegator reward, or commission when the withdraw came from a
 * validator's own commission message. Direction is measured against the module itself, not the row's holder:
 * whether the module is the holder being debited or the counterparty a holder is credited from, the outflow is
 * classified the same on both legs. A flow *into* the module (e.g. MsgFundCommunityPool) is not a reward, so it
 * falls back to a plain transfer.
 */
function classifyDistributionFlow(ctx: ReasonContext, distributionIsHolder: boolean): BalanceReason {
  const leavesModule = distributionIsHolder ? !ctx.isCredit : ctx.isCredit;
  if (!leavesModule) {
    return "transfer";
  }
  return ctx.msgTypeUrl === WITHDRAW_VALIDATOR_COMMISSION ? "commission" : "reward";
}
