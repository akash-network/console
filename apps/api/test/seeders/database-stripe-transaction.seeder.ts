import { faker } from "@faker-js/faker";

import type { StripeTransactionOutput } from "@src/billing/repositories";

export function generateDatabaseStripeTransaction(overrides: Partial<StripeTransactionOutput> = {}) {
  const baseTransaction: StripeTransactionOutput = {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    type: "payment_intent",
    status: "created",
    amount: faker.number.int({ min: 1000, max: 100000 }),
    amountRefunded: 0,
    currency: "usd",
    stripePaymentIntentId: null,
    stripeChargeId: null,
    stripeCouponId: null,
    stripePromotionCodeId: null,
    stripeInvoiceId: null,
    paymentMethodType: null,
    cardBrand: null,
    cardLast4: null,
    receiptUrl: null,
    description: null,
    errorMessage: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent()
  };

  return {
    ...baseTransaction,
    ...overrides
  };
}
