import { faker } from "@faker-js/faker";

import type { Transaction } from "@src/billing/http-schemas/stripe.schema";

export const createStripeTransaction = ({
  id = faker.string.uuid(),
  type = "payment_intent",
  amount = faker.number.int({ min: 1000, max: 100000 }),
  amountRefunded = 0,
  bonusAmount,
  currency = "usd",
  status = "succeeded",
  description = faker.lorem.sentence(),
  created = Math.floor(Date.now() / 1000),
  cardBrand = "visa",
  cardLast4 = "4242",
  stripeInvoiceId = null,
  receiptUrl = faker.internet.url()
}: Partial<Transaction> = {}): Transaction => {
  return {
    id,
    type,
    amount,
    amountRefunded,
    bonusAmount,
    currency,
    status,
    description,
    created,
    cardBrand,
    cardLast4,
    stripeInvoiceId,
    receiptUrl
  };
};
