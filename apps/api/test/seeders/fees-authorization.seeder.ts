import type { FeeAllowance, SpendLimit } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";
import type { PartialDeep } from "type-fest";

import { AkashAddressSeeder } from "./akash-address.seeder";

import { DenomSeeder } from "@test/seeders/denom.seeder";

export interface FeeAllowanceSeederInput {
  granter: string;
  grantee: string;
  allowance: {
    spend_limit: SpendLimit;
    expiration: string;
  };
}

export class FeesAuthorizationSeeder {
  static create(input: PartialDeep<FeeAllowanceSeederInput> = {}): FeeAllowance {
    return merge({
      granter: input.granter || AkashAddressSeeder.create(),
      grantee: input.grantee || AkashAddressSeeder.create(),
      allowance: {
        "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization",
        spend_limit: [
          {
            denom: input.allowance.spend_limit.denom || DenomSeeder.create(),
            amount: input.allowance.spend_limit.amount || faker.number.int({ min: 0, max: 10000000 }).toString()
          }
        ],
        expiration: faker.date.future().toISOString()
      }
    });
  }
}
