import { fromBase64, toHex } from "@cosmjs/encoding";
import { QueryAllBalancesRequest, QueryAllBalancesResponse, QueryTotalSupplyRequest, QueryTotalSupplyResponse } from "cosmjs-types/cosmos/bank/v1beta1/query";

import type { CoinAmount } from "@src/pipeline/balance/coin-amount";

export const ALL_BALANCES_PATH = "/cosmos.bank.v1beta1.Query/AllBalances";
export const TOTAL_SUPPLY_PATH = "/cosmos.bank.v1beta1.Query/TotalSupply";

/** Cosmos paginates bank queries; a single large page covers any account's handful of denoms and the chain's denom set. */
const PAGE_LIMIT = 10_000n;

export function encodeAllBalancesRequest(address: string): string {
  return toHex(QueryAllBalancesRequest.encode(QueryAllBalancesRequest.fromPartial({ address, pagination: pageRequest() })).finish());
}

export function encodeTotalSupplyRequest(): string {
  return toHex(QueryTotalSupplyRequest.encode(QueryTotalSupplyRequest.fromPartial({ pagination: pageRequest() })).finish());
}

export function decodeAllBalances(value: string | null): CoinAmount[] {
  if (!value) {
    return [];
  }
  return toCoinAmounts(QueryAllBalancesResponse.decode(fromBase64(value)).balances);
}

export function decodeTotalSupply(value: string | null): CoinAmount[] {
  if (!value) {
    return [];
  }
  return toCoinAmounts(QueryTotalSupplyResponse.decode(fromBase64(value)).supply);
}

function pageRequest() {
  return { key: new Uint8Array(), offset: 0n, limit: PAGE_LIMIT, countTotal: false, reverse: false };
}

function toCoinAmounts(coins: { denom: string; amount: string }[]): CoinAmount[] {
  return coins.map(coin => ({ denom: coin.denom, amount: BigInt(coin.amount) }));
}
