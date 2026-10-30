import { faker } from "@faker-js/faker";

import type { PaymentCreditOutput } from "@src/billing/repositories/payment-credit/payment-credit.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

export function createPaymentCredit(overrides: Partial<PaymentCreditOutput> = {}): PaymentCreditOutput {
  return {
    transactionId: faker.string.uuid(),
    status: "pending",
    address: createAkashAddress(),
    amount: faker.number.int({ min: 100, max: 100_000 }),
    txHash: faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase(),
    createdAt: new Date(),
    ...overrides
  };
}
