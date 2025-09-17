import { generatePaymentMethod } from "./payment-method.seeder";
import { createStripeTransaction } from "./stripe-transaction.seeder";

export function createTestTransaction(overrides: Partial<ReturnType<typeof createStripeTransaction>> = {}) {
  return createStripeTransaction({
    id: "ch_123",
    amount: 1000,
    created: 1640995200,
    paymentMethod: generatePaymentMethod({
      type: "card",
      card: {
        brand: "visa",
        last4: "4242"
      }
    }),
    ...overrides
  });
}
