import type { Balance } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";

import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";

import { DenomSeeder } from "@test/seeders/denom.seeder";

export class BalanceSeeder {
  static create(input: Partial<Balance> = {}): Balance {
    return merge(
      {
        denom: DenomSeeder.create(),
        amount: faker.number.int({ min: 0, max: 10000000 }).toString()
      },
      input
    );
  }
}

export function generateBalance(overrides: Partial<GetBalancesResponseOutput["data"]> = {}): GetBalancesResponseOutput["data"] {
  const balance = overrides.balance ?? faker.number.float({ min: 0, max: 1000, fractionDigits: 2 });
  const deployments = overrides.deployments ?? faker.number.float({ min: 0, max: 1000, fractionDigits: 2 });
  const total = overrides.total ?? parseFloat((balance + deployments).toFixed(2));

  return merge(
    {
      balance,
      deployments,
      total
    },
    overrides
  );
}
