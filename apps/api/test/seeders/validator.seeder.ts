import { Validator } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

import { createAkashAddress } from "./akash-address.seeder";

export const createValidator = async (overrides: Partial<CreationAttributes<Validator>> = {}): Promise<Validator> => {
  return await Validator.create({
    id: overrides.id || faker.string.uuid(),
    operatorAddress: overrides.operatorAddress || createAkashAddress(),
    accountAddress: overrides.accountAddress || createAkashAddress(),
    hexAddress: overrides.hexAddress || createAkashAddress(),
    moniker: overrides.moniker || faker.company.name(),
    rate: overrides.rate || faker.number.int({ min: 0, max: 10000000 }),
    maxRate: overrides.maxRate || faker.number.int({ min: 0, max: 10000000 }),
    maxChangeRate: overrides.maxChangeRate || faker.number.int({ min: 0, max: 10000000 }),
    minSelfDelegation: overrides.minSelfDelegation || faker.number.int({ min: 0, max: 10000000 }),
    keybaseUsername: overrides.keybaseUsername || faker.internet.userName(),
    keybaseAvatarUrl: overrides.keybaseAvatarUrl || faker.image.avatar()
  });
};
