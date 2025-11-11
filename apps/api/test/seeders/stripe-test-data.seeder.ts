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

export function createTestCoupon(overrides: Partial<Stripe.Coupon> = {}): Stripe.Coupon {
  const stripeData = StripeSeederCreate();
  const baseCoupon = stripeData.promotionCode.promotion.coupon;
  if (typeof baseCoupon === "string") {
    throw new Error("Coupon should be expanded");
  }
  return {
    ...baseCoupon,
    ...overrides
  } as Stripe.Coupon;
}

export function createTestInvoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: "in_test_123",
    object: "invoice",
    account_country: "US",
    account_name: "Test Account",
    account_tax_ids: null,
    amount_due: 0,
    amount_paid: 0,
    amount_remaining: 0,
    amount_shipping: 0,
    application: null,
    application_fee_amount: null,
    attempt_count: 0,
    attempted: false,
    auto_advance: false,
    automatic_tax: {
      enabled: false,
      liability: null,
      status: null
    },
    billing_reason: "manual",
    charge: null,
    collection_method: "charge_automatically",
    created: 1234567890,
    currency: "usd",
    custom_fields: null,
    customer: TEST_CONSTANTS.CUSTOMER_ID,
    customer_address: null,
    customer_email: "test@example.com",
    customer_name: null,
    customer_phone: null,
    customer_shipping: null,
    customer_tax_exempt: "none",
    customer_tax_ids: [],
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    discounts: [],
    due_date: null,
    effective_at: null,
    ending_balance: 0,
    footer: null,
    from_invoice: null,
    hosted_invoice_url: null,
    invoice_pdf: null,
    issuer: {
      type: "self"
    },
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: "list",
      data: [],
      has_more: false,
      url: "/v1/invoices/in_test_123/lines"
    },
    livemode: false,
    metadata: {},
    next_payment_attempt: null,
    number: null,
    on_behalf_of: null,
    paid: true,
    paid_out_of_band: false,
    payment_intent: null,
    payment_settings: {
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null
    },
    period_end: 1234567890,
    period_start: 1234567890,
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    quote: null,
    receipt_number: null,
    rendering: null,
    rendering_options: null,
    shipping_cost: null,
    shipping_details: null,
    starting_balance: 0,
    statement_descriptor: null,
    status: "paid",
    status_transitions: {
      finalized_at: 1234567890,
      marked_uncollectible_at: null,
      paid_at: 1234567890,
      voided_at: null
    },
    subscription: null,
    subscription_details: {
      metadata: null
    },
    subtotal: 0,
    subtotal_excluding_tax: 0,
    tax: null,
    test_clock: null,
    total: 0,
    total_discount_amounts: [],
    total_excluding_tax: 0,
    total_tax_amounts: [],
    transfer_data: null,
    webhooks_delivered_at: null,
    ...overrides
  } as Stripe.Invoice;
}
