import type { RestCosmosBankBalancesResponse } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";

export function createBankBalancesResponse(input: Partial<RestCosmosBankBalancesResponse> = {}): RestCosmosBankBalancesResponse {
  return merge(
    {
      balances: [
        { denom: "uact", amount: faker.number.int({ min: 0, max: 10_000_000_000 }).toString() },
        { denom: "uakt", amount: faker.number.int({ min: 0, max: 100_000_000_000 }).toString() }
      ],
      pagination: { next_key: null, total: 2 }
    },
    input
  );
}
