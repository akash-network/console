import { faker } from "@faker-js/faker";

import type { AutoTopUpDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { createAkashAddress } from "./akash-address.seeder";

export class AutoTopUpDeploymentSeeder {
  static create(overrides: Partial<AutoTopUpDeployment> = {}): AutoTopUpDeployment {
    return {
      id: faker.string.uuid(),
      walletId: faker.number.int(),
      dseq: faker.string.numeric(),
      address: createAkashAddress(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<AutoTopUpDeployment> = {}): AutoTopUpDeployment[] {
    return Array.from({ length: count }, () => AutoTopUpDeploymentSeeder.create(overrides));
  }
}
