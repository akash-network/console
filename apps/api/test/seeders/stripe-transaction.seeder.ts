import { faker } from "@faker-js/faker";

import type { Transaction } from "@src/billing/http-schemas/stripe.schema";

import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";

export class StripeTransactionSeeder {
  static create({
    id = faker.string.uuid(),
    amount = faker.number.int({ min: 1000, max: 100000 }),
    currency = "usd",
    status = "succeeded",
    description = faker.lorem.sentence(),
    created = new Date().getTime(),
    metadata = {},
    paymentMethod = generatePaymentMethod(),
    receiptUrl = faker.internet.url()
  }: Partial<Transaction> = {}): Transaction {
    return {
      id,
      amount,
      currency,
      status,
      description,
      created,
      paymentMethod,
      receiptUrl,
      metadata
    };
  }
}
