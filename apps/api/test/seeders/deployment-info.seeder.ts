import { faker } from "@faker-js/faker";

import type { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import { betaTypeVersion } from "@src/utils/constants";
import { AkashAddressSeeder } from "./akash-address.seeder";
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
      owner = AkashAddressSeeder.create(),
      dseq = faker.string.numeric(),
      state = "active",
      version = betaTypeVersion,
      createdAt = "2021-01-01T00:00:00Z",
      amount = "5000000",
      denom = DenomSeeder.create()
    } = input;

    return {
      deployment: {
        deployment_id: {
          owner,
          dseq
        },
        state,
        version,
        created_at: createdAt
      },
      groups: [],
      escrow_account: {
        id: {
          scope: "deployment",
          xid: dseq
        },
        owner,
        state: "open",
        balance: {
          denom,
          amount
        },
        transferred: {
          denom,
          amount: "0"
        },
        settled_at: new Date().toISOString(),
        depositor: owner,
        funds: {
          denom,
          amount
        }
      }
    };
  }

  static createMany(count: number, input: DeploymentInfoSeederInput = {}): RestAkashDeploymentInfoResponse[] {
    return Array.from({ length: count }, () => this.create(input));
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
