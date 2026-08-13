import type { balanceChangeReason } from "@src/db/schema";
import type { ModuleAddressRegistry } from "@src/pipeline/balance/module-address-registry";

export type BalanceReason = (typeof balanceChangeReason.enumValues)[number];

/** What the classifier knows about one coin movement: who moved it, the correlated counterparty, and any coincident mint/burn/slash. */
export interface ReasonContext {
  address: string;
  counterpartyAddress: string | null;
  denom: string;
  isMint: boolean;
  isBurn: boolean;
  isSlash: boolean;
  msgTypeUrl: string | null;
}

const WITHDRAW_VALIDATOR_COMMISSION = "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission";

/**
 * MVP reason heuristic. Coincident mint/burn/slash win first (they are unambiguous), then the identity of
 * the system account on either side of the movement, then the denom. Anything unrecognized is a plain
 * `transfer`. `reward`/`commission` and per-deployment `escrow` precision are deliberately left for later.
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

  const role = (ctx.counterpartyAddress ? registry.roleOf(ctx.counterpartyAddress) : undefined) ?? registry.roleOf(ctx.address);
  switch (role) {
    case "mint":
      return "mint";
    case "fee_collector":
      return "fee";
    case "distribution":
      return ctx.msgTypeUrl === WITHDRAW_VALIDATOR_COMMISSION ? "commission" : "reward";
    case "bonded_tokens_pool":
    case "not_bonded_tokens_pool":
      return "staking";
    case "gov":
      return "gov";
    case "ibc_transfer":
      return "ibc";
    case "bme_vault":
      return "bme";
  }

  return ctx.denom.startsWith("ibc/") ? "ibc" : "transfer";
}
