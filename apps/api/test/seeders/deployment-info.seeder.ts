import { generateManifest, type SDLInput, yaml } from "@akashnetwork/chain-sdk";
import { Endpoint_Kind, type GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
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

/** The groups the chain holds for a deployment created from this SDL, in the shape its REST API describes them. */
export function createDeploymentInfoGroupsFromSdl(input: { sdl: string; owner?: string; dseq?: string }): DeploymentInfo["groups"] {
  const { sdl, owner = createAkashAddress(), dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false }) } = input;
  const result = generateManifest(yaml.raw<SDLInput>(sdl));

  if (!result.ok) {
    throw new Error(`Cannot derive groups from an invalid SDL: ${result.value.map(error => error.message).join(", ")}`);
  }

  return result.value.groupSpecs.map((spec, index) => ({
    id: { owner, dseq, gseq: index + 1 },
    state: "open",
    group_spec: toOnChainGroupSpec(spec),
    created_at: "1"
  }));
}

function toOnChainGroupSpec(spec: GroupSpec): DeploymentInfo["groups"][number]["group_spec"] {
  return {
    name: spec.name,
    requirements: {
      signed_by: { all_of: spec.requirements?.signedBy?.allOf ?? [], any_of: spec.requirements?.signedBy?.anyOf ?? [] },
      attributes: spec.requirements?.attributes ?? []
    },
    resources: spec.resources.map(({ resource, count, price }) => {
      const { id, cpu, memory, storage, gpu, endpoints } = resource!;

      return {
        resource: {
          id,
          cpu: { units: { val: String(cpu!.units!.val) }, attributes: cpu!.attributes },
          memory: { quantity: { val: String(memory!.quantity!.val) }, attributes: memory!.attributes },
          storage: storage.map(volume => ({ name: volume.name, quantity: { val: String(volume.quantity!.val) }, attributes: volume.attributes })),
          gpu: { units: { val: String(gpu!.units!.val) }, attributes: gpu!.attributes },
          endpoints: endpoints.map(endpoint => ({ kind: Endpoint_Kind[endpoint.kind], sequence_number: endpoint.sequenceNumber }))
        },
        count,
        price: { denom: price!.denom, amount: price!.amount }
      };
    })
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
