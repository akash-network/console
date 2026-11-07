import { faker } from "@faker-js/faker";

import type { RefundDebitOutput } from "@src/billing/repositories/refund-debit/refund-debit.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

export function createRefundDebit(overrides: Partial<RefundDebitOutput> = {}): RefundDebitOutput {
  return {
    transactionId: faker.string.uuid(),
    amountRefunded: faker.number.int({ min: 100, max: 100_000 }),
    status: "pending",
    address: createAkashAddress(),
    amount: faker.number.int({ min: 100, max: 100_000 }),
    txHash: faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase(),
    createdAt: new Date(),
    ...overrides
  };
}
