import type { Balance } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";

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
