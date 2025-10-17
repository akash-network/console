import { faker } from "@faker-js/faker";

import type { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import { deploymentVersion } from "@src/utils/constants";
import { createAkashAddress } from "./akash-address.seeder";
import { DenomSeeder } from "./denom.seeder";

export interface DeploymentInfoSeederInput {
  owner?: string;
  dseq?: string;
  state?: string;
  version?: string;
  createdAt?: string;
  amount?: string;
  denom?: string;
}

export interface DeploymentInfoErrorSeederInput {
  code?: number;
  message?: string;
  details?: any[];
}

export class DeploymentInfoSeeder {
  static create(input: DeploymentInfoSeederInput = {}): RestAkashDeploymentInfoResponse {
    const {
      owner = createAkashAddress(),
      dseq = faker.string.numeric(),
      state = "active",
      version = deploymentVersion,
      createdAt = "2021-01-01T00:00:00Z",
      amount = "5000000",
      denom = DenomSeeder.create()
    } = input;

    return {
      deployment: {
        id: {
          owner,
          dseq
        },
        state,
        hash: version,
        created_at: createdAt
      },
      groups: [],
      escrow_account: {
        id: {
          scope: "deployment",
          xid: dseq
        },
        state: {
          owner,
          state: "open",
          transferred: [
            {
              denom,
              amount: "0"
            }
          ],
          settled_at: new Date().toISOString(),
          funds: [
            {
              denom,
              amount
            }
          ],
          deposits: [
            {
              owner,
              height: "1",
              source: "balance",
              balance: {
                denom,
                amount
              }
            }
          ]
        }
      }
    };
  }

  static createMany(count: number, input: DeploymentInfoSeederInput = {}): RestAkashDeploymentInfoResponse[] {
    return Array.from({ length: count }, () => DeploymentInfoSeeder.create(input));
  }

  static createError(input: DeploymentInfoErrorSeederInput = {}): RestAkashDeploymentInfoResponse {
    const { code = 404, message = "Deployment not found", details = [] } = input;

    return {
      code,
      message,
      details
    };
  }
}
