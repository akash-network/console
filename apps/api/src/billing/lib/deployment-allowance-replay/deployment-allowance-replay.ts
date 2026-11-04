import { DepositAuthorization } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgGrant, MsgRevoke } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { parseCoins } from "@cosmjs/proto-signing";

import type { AllowanceChange } from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";

const MSG_GRANT_TYPE_URL = `/${MsgGrant.$type}`;
const MSG_REVOKE_TYPE_URL = `/${MsgRevoke.$type}`;

/** The allowance after these changes, starting from `limit`: a grant or revoke sets it, and the escrow module moves it with the granter's coins, down by those a deposit spent and up by those a closing deployment returned. */
export function replayAllowance(limit: number, changes: AllowanceChange[], denom: string): number {
  return changes.reduce((current, change) => applyChange(current, change, denom), limit);
}

function applyChange(limit: number, { type, data, spentByGranter, receivedByGranter }: AllowanceChange, denom: string): number {
  if (type === MSG_GRANT_TYPE_URL) return grantedLimitOf(MsgGrant.decode(data), denom);
  if (type === MSG_REVOKE_TYPE_URL) return 0;

  return limit - totalOf(spentByGranter, denom) + totalOf(receivedByGranter, denom);
}

function totalOf(amounts: string[], denom: string): number {
  return amounts.flatMap(coins => parseCoins(coins)).reduce((total, coin) => (coin.denom === denom ? total + Number(coin.amount) : total), 0);
}

/** Reads the limits the way the allowance read does, so a grant still carrying the single legacy limit counts the same in both. */
function grantedLimitOf({ grant }: MsgGrant, denom: string): number {
  const { spendLimit, spendLimits } = DepositAuthorization.decode(grant!.authorization!.value);
  const limit = [...spendLimits, spendLimit].find(coin => coin?.denom === denom);

  return limit ? Number(limit.amount) : 0;
}
