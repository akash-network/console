import { createStripeTransaction } from "./stripe-transaction.seeder";

export function createTestTransaction(overrides: Partial<ReturnType<typeof createStripeTransaction>> = {}) {
  return createStripeTransaction({
    id: "ch_123",
    type: "payment_intent",
    amount: 1000,
    created: 1640995200,
    cardBrand: "visa",
    cardLast4: "4242",
    ...overrides
  });
}
