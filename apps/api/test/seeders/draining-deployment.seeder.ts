import { faker } from "@faker-js/faker";

import type { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";

import { DenomSeeder } from "@test/seeders/denom.seeder";

export class DrainingDeploymentSeeder {
  static create({
    dseq = faker.number.int({ min: 1, max: 99999999 }),
    denom = DenomSeeder.create(),
    blockRate = faker.number.int({ min: 1, max: 100 }),
    predictedClosedHeight = faker.number.int({ min: 1, max: 99999999 })
  }: Partial<DrainingDeploymentOutput> = {}): DrainingDeploymentOutput {
    return {
      dseq,
      denom,
      blockRate,
      predictedClosedHeight
    };
  }
}
