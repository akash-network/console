import { toBase64 } from "@cosmjs/encoding";
import { QueryAllBalancesResponse, QueryTotalSupplyResponse } from "cosmjs-types/cosmos/bank/v1beta1/query";
import { describe, expect, it } from "vitest";

import {
  ALL_BALANCES_PATH,
  decodeAllBalances,
  decodeTotalSupply,
  encodeAllBalancesRequest,
  encodeTotalSupplyRequest,
  TOTAL_SUPPLY_PATH
} from "@src/reconcile/bank-query";

describe("bank-query", () => {
  it("encodes an all-balances request as hex carrying the address", () => {
    const hex = encodeAllBalancesRequest("akash1abc");

    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(Buffer.from(hex, "hex").toString("utf8")).toContain("akash1abc");
    expect(ALL_BALANCES_PATH).toBe("/cosmos.bank.v1beta1.Query/AllBalances");
  });

  it("encodes a total-supply request as hex", () => {
    expect(encodeTotalSupplyRequest()).toMatch(/^[0-9a-f]*$/);
    expect(TOTAL_SUPPLY_PATH).toBe("/cosmos.bank.v1beta1.Query/TotalSupply");
  });

  it("decodes an all-balances response into typed coins", () => {
    const value = toBase64(QueryAllBalancesResponse.encode({ balances: [{ denom: "uakt", amount: "42" }], pagination: undefined }).finish());

    expect(decodeAllBalances(value)).toEqual([{ denom: "uakt", amount: 42n }]);
  });

  it("decodes a total-supply response into typed coins", () => {
    const value = toBase64(QueryTotalSupplyResponse.encode({ supply: [{ denom: "uakt", amount: "1000" }], pagination: undefined }).finish());

    expect(decodeTotalSupply(value)).toEqual([{ denom: "uakt", amount: 1000n }]);
  });

  it("decodes an empty value as no coins", () => {
    expect(decodeAllBalances(null)).toEqual([]);
    expect(decodeTotalSupply(null)).toEqual([]);
  });
});
