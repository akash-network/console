import type { DeploymentInfo } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

import type { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import { deploymentVersion } from "@src/utils/constants";
import { createAkashAddress } from "./akash-address.seeder";
import { createDenom } from "./denom.seeder";

export interface DeploymentInfoSeederInput {
  owner?: string;
  dseq?: string;
  state?: string;
  version?: string;
  createdAt?: string;
  amount?: string;
  denom?: string;
  groups?: DeploymentInfo["groups"];
}

export interface DeploymentInfoErrorSeederInput {
  code?: number;
  message?: string;
  details?: any[];
}

export interface DeploymentInfoGroupSeederInput {
  owner?: string;
  dseq?: string;
  gseq?: number;
  name?: string;
  cpuUnits?: string;
}

/** A resource group as the chain describes it, which is a different shape from the indexer row `createDeploymentGroup` seeds. */
export function createDeploymentInfoGroupSeed(input: DeploymentInfoGroupSeederInput = {}): DeploymentInfo["groups"][number] {
  const {
    owner = createAkashAddress(),
    dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false }),
    gseq = 1,
    name = faker.word.noun(),
    cpuUnits = "1000"
  } = input;

  return {
    id: { owner, dseq, gseq },
    state: "open",
    group_spec: {
      name,
      requirements: { signed_by: { all_of: [], any_of: [] }, attributes: [] },
      resources: [
        {
          resource: {
            id: 1,
            cpu: { units: { val: cpuUnits }, attributes: [] },
            memory: { quantity: { val: "536870912" }, attributes: [] },
            storage: [{ name: "default", quantity: { val: "536870912" }, attributes: [] }],
            gpu: { units: { val: "0" }, attributes: [] },
            endpoints: [{ kind: "SHARED_HTTP", sequence_number: 0 }]
          },
          count: 1,
          price: { denom: createDenom(), amount: "1000" }
        }
      ]
    },
    created_at: "1"
  };
}

export function createDeploymentInfoSeed(input: DeploymentInfoSeederInput = {}): DeploymentInfo {
  const {
    owner = createAkashAddress(),
    dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false }),
    state = "active",
    version = deploymentVersion,
    createdAt = "2021-01-01T00:00:00Z",
    amount = "5000000",
    denom = createDenom(),
    groups = []
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
    groups,
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

export function createManyDeploymentInfoSeeds(count: number, input: DeploymentInfoSeederInput = {}): DeploymentInfo[] {
  return Array.from({ length: count }, () => createDeploymentInfoSeed(input));
}

export function createDeploymentInfoErrorSeed(input: DeploymentInfoErrorSeederInput = {}): RestAkashDeploymentInfoResponse {
  const { code = 404, message = "Deployment not found", details = [] } = input;

  return {
    code,
    message,
    details
  };
}
