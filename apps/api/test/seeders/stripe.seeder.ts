import type { Stripe } from "stripe";

export type StripeMockData = {
  customer: Stripe.Customer;
  paymentIntent: Stripe.PaymentIntent;
  setupIntent: Stripe.SetupIntent;
  checkoutSession: Stripe.Checkout.Session;
  promotionCode: Stripe.PromotionCode;
};

export function create(overrides?: Partial<StripeMockData>): StripeMockData {
  const defaultData: StripeMockData = {
    customer: {
      id: "cus_123",
      email: "test@example.com",
      name: "Test User",
      object: "customer",
      created: 1234567890,
      livemode: false,
      metadata: {},
      shipping: null,
      tax: undefined,
      tax_exempt: "none",
      test_clock: null,
      balance: 0,
      default_source: null,
      description: null,
      invoice_settings: {
        custom_fields: null,
        default_payment_method: null,
        footer: null,
        rendering_options: null
      }
    },
    paymentIntent: {
      id: "pi_123",
      status: "succeeded",
      object: "payment_intent",
      amount: 10000,
      currency: "usd",
      created: 1234567890,
      customer: "cus_123",
      payment_method: "pm_123",
      payment_method_types: ["card"],
      metadata: {},
      livemode: false,
      client_secret: "pi_123_secret",
      confirmation_method: "automatic",
      receipt_email: null,
      setup_future_usage: null,
      shipping: null,
      transfer_data: null,
      transfer_group: null,
      amount_capturable: 0,
      amount_received: 10000,
      application: null,
      application_fee_amount: null,
      automatic_payment_methods: null,
      canceled_at: null,
      cancellation_reason: null,
      capture_method: "automatic",
      description: null,
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
      excluded_payment_method_types: null
    },
    setupIntent: {
      id: "seti_123",
      client_secret: "secret_123",
      object: "setup_intent",
      created: 1234567890,
      customer: "cus_123",
      payment_method: "pm_123",
      payment_method_types: ["card"],
      status: "succeeded",
      usage: "off_session",
      livemode: false,
      metadata: {},
      next_action: null,
      mandate: null,
      single_use_mandate: null,
      application: null,
      automatic_payment_methods: null,
      cancellation_reason: null,
      description: null,
      flow_directions: null,
      last_setup_error: null,
      latest_attempt: null,
      on_behalf_of: null,
      payment_method_options: {},
      payment_method_configuration_details: null,
      excluded_payment_method_types: null
    },
    checkoutSession: {
      id: "cs_123",
      url: "https://checkout.url",
      object: "checkout.session",
      created: 1234567890,
      customer: "cus_123",
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      amount_total: 2000,
      currency: "usd",
      livemode: false,
      metadata: {},
      payment_intent: "pi_123",
      payment_method_types: ["card"],
      success_url: "https://return.url?session_id={CHECKOUT_SESSION_ID}&payment-success=true",
      cancel_url: "https://return.url?session_id={CHECKOUT_SESSION_ID}&payment-canceled=true",
      after_expiration: null,
      allow_promotion_codes: true,
      amount_subtotal: 2000,
      automatic_tax: { enabled: false, status: null, liability: null, provider: null },
      billing_address_collection: null,
      client_reference_id: null,
      client_secret: null,
      consent: null,
      consent_collection: null,
      currency_conversion: null,
      customer_creation: "always",
      customer_details: null,
      customer_email: null,
      custom_fields: [],
      adaptive_pricing: null,
      collected_information: null,
      discounts: [],
      origin_context: null,
      redirect_on_completion: "always",
      custom_text: {
        after_submit: {
          message: "test"
        },
        shipping_address: {
          message: "test"
        },
        submit: {
          message: "test"
        },
        terms_of_service_acceptance: {
          message: "test"
        }
      },
      expires_at: 0,
      invoice: null,
      invoice_creation: null,
      locale: null,
      payment_method_collection: "always",
      payment_method_options: {},
      payment_link: null,
      payment_method_configuration_details: null,
      saved_payment_method_options: null,
      phone_number_collection: { enabled: false },
      permissions: null,
      wallet_options: null,
      recovered_from: null,
      setup_intent: null,
      shipping_address_collection: null,
      shipping_cost: null,
      shipping_options: [],
      submit_type: null,
      subscription: null,
      tax_id_collection: { enabled: false, required: "never" },
      total_details: null,
      ui_mode: "hosted"
    },
    promotionCode: {
      id: "promo_123",
      code: "TEST50",
      object: "promotion_code",
      active: true,
      created: 1234567890,
      customer: null,
      expires_at: null,
      livemode: false,
      max_redemptions: null,
      metadata: {},
      restrictions: {
        first_time_transaction: false,
        minimum_amount: null,
        minimum_amount_currency: null
      },
      promotion: {
        type: "coupon",
        coupon: {
          id: "coupon_123",
          object: "coupon",
          amount_off: null,
          created: 1234567890,
          currency: null,
          duration: "once",
          duration_in_months: null,
          livemode: false,
          max_redemptions: null,
          metadata: {},
          name: "50% off",
          percent_off: 50,
          redeem_by: null,
          times_redeemed: 0,
          valid: true
        }
      },
      times_redeemed: 0
    }
  };

  return {
    ...defaultData,
    ...overrides
  };
}

export default {
  create
};
