import { faker } from "@faker-js/faker";

import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { createAkashAddress } from "./akash-address.seeder";

type DeploymentData = GetDeploymentResponse["data"];
type DeploymentLease = DeploymentData["leases"][number];

export const ASSISTANT_TEST_SDL = `version: "2.0"
services:
  web:
    image: nginx:1.25.3
    env:
      - PORT=80
      - API_KEY=ac-secret://API_KEY
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
        memory:
          size: 1Gi
        storage:
          size: 2Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

export function createDeploymentLease(overrides: Partial<DeploymentLease> & { dseq?: string; provider?: string } = {}): DeploymentLease {
  const { dseq = faker.string.numeric(8), provider = createAkashAddress(), ...lease } = overrides;

  return {
    id: { owner: createAkashAddress(), dseq, gseq: 1, oseq: 1, provider, bseq: 1 },
    state: "active",
    price: { denom: "uact", amount: "1000" },
    created_at: faker.string.numeric(7),
    closed_on: "0",
    status: null,
    ...lease
  };
}

export function createGetDeploymentResponseData(
  overrides: { dseq?: string; state?: string; name?: string | null; sdl?: string | null; manifestVersion?: string; leases?: DeploymentLease[] } = {}
): DeploymentData {
  const dseq = overrides.dseq ?? faker.string.numeric(8);
  const owner = createAkashAddress();
  const sdl = overrides.sdl === undefined ? ASSISTANT_TEST_SDL : overrides.sdl;

  return {
    deployment: { id: { owner, dseq }, state: overrides.state ?? "active", hash: faker.string.alphanumeric(32), created_at: faker.string.numeric(7) },
    leases: overrides.leases ?? [],
    escrow_account: {
      id: { scope: "deployment", xid: `${owner}/${dseq}` },
      state: { owner, state: "open", transferred: [], settled_at: "0", funds: [{ denom: "uact", amount: "5000000" }], deposits: [] }
    },
    name: overrides.name === undefined ? faker.word.noun() : overrides.name,
    consoleSettings: sdl === null ? null : { sdl, manifestVersion: overrides.manifestVersion ?? faker.string.alphanumeric(44), templateId: null }
  };
}
