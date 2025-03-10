import { faker } from "@faker-js/faker";
import { merge } from "lodash";

import { AkashAddressSeeder } from "./akash-address.seeder";

export type Validator = {
  id: string;
  operatorAddress: string;
  accountAddress: string;
  hexAddress: string;
  createdMsgId?: string;
  moniker: string;
  identity?: string;
  website?: string;
  description?: string;
  securityContact?: string;
  rate: number;
  maxRate: number;
  maxChangeRate: number;
  minSelfDelegation: number;
  keybaseUsername?: string;
  keybaseAvatarUrl?: string;
};

export class ValidatorSeeder {
  static create(input: Partial<Validator> = {}): Validator {
    return merge(
      {
        id: faker.string.uuid(),
        operatorAddress: AkashAddressSeeder.create(),
        accountAddress: AkashAddressSeeder.create(),
        hexAddress: AkashAddressSeeder.create(),
        moniker: faker.company.name(),
        rate: faker.number.int({ min: 0, max: 10000000 }),
        maxRate: faker.number.int({ min: 0, max: 10000000 }),
        maxChangeRate: faker.number.int({ min: 0, max: 10000000 }),
        minSelfDelegation: faker.number.int({ min: 0, max: 10000000 }),
        keybaseAvatarUrl: faker.image.avatar()
      },
      input
    );
  }
}
