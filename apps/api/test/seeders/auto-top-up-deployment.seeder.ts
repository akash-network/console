import { faker } from "@faker-js/faker";

import type { AutoTopUpDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { createAkashAddress } from "./akash-address.seeder";

export function createAutoTopUpDeployment(overrides: Partial<AutoTopUpDeployment> = {}): AutoTopUpDeployment {
  const userId = overrides.userId ?? faker.string.uuid();

  return {
    id: faker.string.uuid(),
    userId,
    walletId: faker.number.int(),
    walletUserId: userId,
    dseq: faker.string.numeric({ length: 8, allowLeadingZeros: false }),
    address: createAkashAddress(),
    isWalletAutoTopUpEnabled: false,
    walletIsTrialing: false,
    walletCreatedAt: faker.date.recent(),
    walletActivatedAt: faker.date.recent(),
    walletCreditsLowNotifiedAt: null,
    runtimeLimitHours: null,
    runtimeEndsAt: null,
    lastFundedAt: null,
    ...overrides
  };
}

export function createManyAutoTopUpDeployments(count: number, overrides: Partial<AutoTopUpDeployment> = {}): AutoTopUpDeployment[] {
  return Array.from({ length: count }, () => createAutoTopUpDeployment(overrides));
}
