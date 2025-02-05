import { faker } from "@faker-js/faker";

import { AutoTopUpDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { AkashAddressSeeder } from "./akash-address.seeder";

export class AutoTopUpDeploymentSeeder {
  static create(overrides: Partial<AutoTopUpDeployment> = {}): AutoTopUpDeployment {
    return {
      id: faker.string.uuid(),
      walletId: faker.number.int(),
      dseq: faker.string.numeric(),
      address: AkashAddressSeeder.create(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<AutoTopUpDeployment> = {}): AutoTopUpDeployment[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}
