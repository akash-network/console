import type Stripe from "stripe";

import { create as StripeSeederCreate } from "./stripe.seeder";

export const TEST_CONSTANTS = {
  CUSTOMER_ID: "cus_123",
  USER_ID: "user_123",
  PAYMENT_METHOD_ID: "pm_123",
  PAYMENT_INTENT_ID: "pi_test_123",
  PROMOTION_CODE_ID: "promo_123",
  COUPON_ID: "coupon_123"
} as const;

export function createTestPaymentIntent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return {
    id: TEST_CONSTANTS.PAYMENT_INTENT_ID,
    status: "succeeded",
    amount: 100,
    object: "payment_intent",
    currency: "usd",
    created: 1234567890,
    customer: TEST_CONSTANTS.CUSTOMER_ID,
    payment_method: TEST_CONSTANTS.PAYMENT_METHOD_ID,
    payment_method_types: ["card"],
    metadata: {},
    livemode: false,
    client_secret: "pi_test_123_secret",
    confirmation_method: "automatic",
    receipt_email: null,
    setup_future_usage: null,
    shipping: null,
    transfer_data: null,
    transfer_group: null,
    amount_capturable: 0,
    amount_received: 100,
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: "automatic",
    description: null,
    invoice: null,
    last_payment_error: null,
    latest_charge: null,
    next_action: null,
    on_behalf_of: null,
    payment_method_options: {},
    processing: null,
    review: null,
    source: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    payment_method_configuration_details: null,
    ...overrides
  } as Stripe.PaymentIntent;
}

export function createTestCharge(overrides: Partial<Stripe.Charge> = {}): Stripe.Charge {
  return {
    id: "ch_123",
    amount: 1000,
    currency: "usd",
    status: "succeeded",
    created: 1234567890,
    payment_method_details: { type: "card" },
    receipt_url: "https://receipt.url",
    description: "Test charge",
    metadata: {},
    object: "charge",
    livemode: false,
    paid: true,
    refunded: false,
    amount_captured: 1000,
    amount_refunded: 0,
    application: null,
    application_fee: null,
    application_fee_amount: null,
    balance_transaction: null,
    billing_details: {
      address: {
        city: null,
        country: null,
        line1: null,
        line2: null,
        postal_code: null,
        state: null
      },
      email: null,
      name: null,
      phone: null
    },
    calculated_statement_descriptor: null,
    captured: true,
    customer: null,
    dispute: null,
    disputed: false,
    failure_code: null,
    failure_message: null,
    fraud_details: {},
    invoice: null,
    on_behalf_of: null,
    order: null,
    outcome: null,
    payment_intent: null,
    payment_method: null,
    receipt_email: null,
    receipt_number: null,
    refunds: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/charges/ch_123/refunds"
    },
    review: null,
    shipping: null,
    source: null,
    source_transfer: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    transfer_data: null,
    transfer_group: null,
    ...overrides
  } as Stripe.Charge;
}

export function createTestPromotionCode(overrides: Partial<Stripe.PromotionCode> = {}) {
  const stripeData = StripeSeederCreate();
  return {
    ...stripeData.promotionCode,
    ...overrides
  };
}

export function createTestCoupon(overrides: Partial<Stripe.Coupon> = {}) {
  const stripeData = StripeSeederCreate();
  return {
    ...stripeData.promotionCode.coupon,
    ...overrides
  };
}
