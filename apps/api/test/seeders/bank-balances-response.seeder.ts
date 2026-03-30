import { faker } from "@faker-js/faker";
import { merge } from "lodash";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";

type BankBalancesResponse = Awaited<ReturnType<ChainSDK["cosmos"]["bank"]["v1beta1"]["getAllBalances"]>>;

export function createBankBalancesResponse(input: Partial<BankBalancesResponse> = {}): BankBalancesResponse {
  return merge(
    {
      balances: [
        { denom: "uact", amount: faker.number.int({ min: 0, max: 10_000_000_000 }).toString() },
        { denom: "uakt", amount: faker.number.int({ min: 0, max: 100_000_000_000 }).toString() }
      ],
      pagination: { nextKey: {}, total: { low: 2, high: 0, unsigned: false } }
    },
    input
  );
}
