import { faker } from "@faker-js/faker";

import type { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";

import { createDenom } from "@test/seeders/denom.seeder";

export function createDrainingDeployment({
  dseq = faker.number.int({ min: 1, max: 99999999 }),
  denom = createDenom(),
  blockRate = faker.number.int({ min: 1, max: 100 }),
  predictedClosedHeight = faker.number.int({ min: 1, max: 99999999 }),
  owner = faker.string.alpha(),
  closedHeight = undefined
}: Partial<DrainingDeploymentOutput> = {}): DrainingDeploymentOutput {
  return {
    dseq,
    denom,
    blockRate,
    predictedClosedHeight,
    owner,
    closedHeight
  };
}
