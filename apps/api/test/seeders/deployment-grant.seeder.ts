import type { DeploymentAllowance } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";
import type { PartialDeep } from "type-fest";

import { AkashAddressSeeder } from "./akash-address.seeder";

import { DenomSeeder } from "@test/seeders/denom.seeder";

export class DeploymentGrantSeeder {
  static create(input: PartialDeep<DeploymentAllowance> = {}): DeploymentAllowance {
    return merge(
      {
        granter: AkashAddressSeeder.create(),
        grantee: AkashAddressSeeder.create(),
        authorization: {
          "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization",
          spend_limit: {
            denom: DenomSeeder.create(),
            amount: faker.number.int({ min: 0, max: 10000000 }).toString()
          },
          expiration: faker.date.future().toISOString()
        }
      },
      input
    );
  }
}
