import type { Validator } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

import { AkashAddressSeeder } from "./akash-address.seeder";

export class ValidatorSeeder {
  static create(input: Partial<CreationAttributes<Validator>> = {}): CreationAttributes<Validator> {
    return {
      id: input.id || faker.string.uuid(),
      operatorAddress: input.operatorAddress || AkashAddressSeeder.create(),
      accountAddress: input.accountAddress || AkashAddressSeeder.create(),
      hexAddress: input.hexAddress || AkashAddressSeeder.create(),
      moniker: input.moniker || faker.company.name(),
      rate: input.rate || faker.number.int({ min: 0, max: 10000000 }),
      maxRate: input.maxRate || faker.number.int({ min: 0, max: 10000000 }),
      maxChangeRate: input.maxChangeRate || faker.number.int({ min: 0, max: 10000000 }),
      minSelfDelegation: input.minSelfDelegation || faker.number.int({ min: 0, max: 10000000 }),
      keybaseAvatarUrl: input.keybaseAvatarUrl || faker.image.avatar()
    };
  }
}
