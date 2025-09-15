import { faker } from "@faker-js/faker";

export interface DatabasePaymentMethod {
  id: string;
  userId: string;
  fingerprint: string;
  paymentMethodId: string;
  isValidated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function generateDatabasePaymentMethod(overrides: Partial<DatabasePaymentMethod> = {}): DatabasePaymentMethod {
  const basePaymentMethod: DatabasePaymentMethod = {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    fingerprint: faker.string.uuid(),
    paymentMethodId: faker.string.uuid(),
    isValidated: false,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent()
  };

  return {
    ...basePaymentMethod,
    ...overrides
  };
}
