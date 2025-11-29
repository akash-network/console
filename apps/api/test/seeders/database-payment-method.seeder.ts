import { faker } from "@faker-js/faker";

import type { PaymentMethodOutput } from "@src/billing/repositories";

export function generateDatabasePaymentMethod(overrides: Partial<PaymentMethodOutput> = {}) {
  const basePaymentMethod: PaymentMethodOutput = {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    fingerprint: faker.string.uuid(),
    paymentMethodId: faker.string.uuid(),
    isValidated: false,
    isDefault: false,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent()
  };

  return {
    ...basePaymentMethod,
    ...overrides
  };
}
