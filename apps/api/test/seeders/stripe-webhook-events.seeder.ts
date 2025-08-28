export type StripeWebhookEventData = {
  checkoutSessionCompleted: any;
  checkoutSessionAsyncPaymentSucceeded: any;
  paymentIntentSucceeded: any;
  paymentMethodAttached: any;
  paymentMethodDetached: any;
  customerDiscountCreated: any;
};

const baseEvent = {
  id: "evt_test",
  object: "event",
  api_version: "2020-08-27",
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  pending_webhooks: 1,
  request: { id: "req_test", idempotency_key: null }
};

export function create(overrides?: Partial<StripeWebhookEventData>): StripeWebhookEventData {
  const defaultData: StripeWebhookEventData = {
    checkoutSessionCompleted: {
      ...baseEvent,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          object: "checkout.session",
          payment_status: "paid",
          amount_subtotal: 2000,
          customer: "cus_test",
          created: Math.floor(Date.now() / 1000),
          currency: "usd",
          livemode: false,
          metadata: {},
          mode: "payment",
          payment_intent: "pi_test",
          status: "complete",
          success_url: "https://example.com/success",
          cancel_url: "https://example.com/cancel",
          client_reference_id: null,
          customer_creation: "always",
          payment_method_collection: "always",
          payment_method_types: ["card"],
          setup_intent: null,
          shipping_address_collection: null,
          submit_type: "auto",
          subscription: null,
          total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
          url: "https://checkout.stripe.com/test"
        }
      }
    },

    checkoutSessionAsyncPaymentSucceeded: {
      ...baseEvent,
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: "cs_test",
          object: "checkout.session",
          payment_status: "paid",
          amount_subtotal: 2000,
          customer: "cus_test",
          created: Math.floor(Date.now() / 1000),
          currency: "usd",
          livemode: false,
          metadata: {},
          mode: "payment",
          payment_intent: "pi_test",
          status: "complete",
          success_url: "https://example.com/success",
          cancel_url: "https://example.com/cancel",
          client_reference_id: null,
          customer_creation: "always",
          payment_method_collection: "always",
          payment_method_types: ["card"],
          setup_intent: null,
          shipping_address_collection: null,
          submit_type: "auto",
          subscription: null,
          total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
          url: "https://checkout.stripe.com/test"
        }
      }
    },

    paymentIntentSucceeded: {
      ...baseEvent,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test",
          object: "payment_intent",
          amount: 2000,
          currency: "usd",
          status: "succeeded",
          customer: "cus_test",
          created: Math.floor(Date.now() / 1000),
          description: "Test payment",
          metadata: {},
          livemode: false,
          client_secret: "pi_test_secret",
          confirmation_method: "automatic",
          last_payment_error: null,
          next_action: null,
          payment_method: "pm_test",
          receipt_email: null,
          setup_future_usage: null,
          shipping: null,
          source: null,
          statement_descriptor: null,
          statement_descriptor_suffix: null,
          transfer_data: null,
          transfer_group: null,
          application: null,
          application_fee_amount: null,
          automatic_payment_methods: null,
          canceled_at: null,
          cancellation_reason: null,
          capture_method: "automatic",
          payment_method_options: {},
          processing: null,
          review: null
        }
      }
    },

    paymentMethodAttached: {
      ...baseEvent,
      type: "payment_method.attached",
      data: {
        object: {
          id: "pm_test",
          object: "payment_method",
          customer: "cus_test",
          card: {
            fingerprint: "test-fingerprint",
            brand: "visa",
            checks: { cvc_check: "pass", address_line1_check: "pass", address_postal_code_check: "pass" },
            country: "US",
            display_brand: "visa",
            exp_month: 12,
            exp_year: 2025,
            funding: "credit",
            last4: "4242",
            networks: { available: ["visa"], preferred: null },
            three_d_secure_usage: { supported: true },
            wallet: null,
            generated_from: null
          },
          created: Math.floor(Date.now() / 1000),
          livemode: false,
          metadata: {},
          type: "card",
          billing_details: {
            address: null,
            email: null,
            name: null,
            phone: null
          }
        }
      }
    },

    paymentMethodDetached: {
      ...baseEvent,
      type: "payment_method.detached",
      data: {
        object: {
          id: "pm_test",
          object: "payment_method",
          customer: "cus_test",
          card: {
            fingerprint: "test-fingerprint",
            brand: "visa",
            checks: { cvc_check: "pass", address_line1_check: "pass", address_postal_code_check: "pass" },
            country: "US",
            display_brand: "visa",
            exp_month: 12,
            exp_year: 2025,
            funding: "credit",
            last4: "4242",
            networks: { available: ["visa"], preferred: null },
            three_d_secure_usage: { supported: true },
            wallet: null,
            generated_from: null
          },
          created: Math.floor(Date.now() / 1000),
          livemode: false,
          metadata: {},
          type: "card",
          billing_details: {
            address: null,
            email: null,
            name: null,
            phone: null
          }
        },
        previous_attributes: {}
      }
    },

    customerDiscountCreated: {
      ...baseEvent,
      type: "customer.discount.created",
      data: {
        object: {
          id: "di_test",
          object: "discount",
          customer: "cus_test",
          coupon: {
            id: "coupon_test",
            object: "coupon",
            created: Math.floor(Date.now() / 1000),
            currency: "usd",
            duration: "once",
            duration_in_months: null,
            livemode: false,
            max_redemptions: null,
            metadata: {},
            name: "Test Coupon",
            percent_off: null,
            redeem_by: null,
            times_redeemed: 0,
            valid: true,
            amount_off: null
          },
          created: Math.floor(Date.now() / 1000),
          livemode: false,
          metadata: {},
          promotion_code: null,
          start: null,
          end: null,
          subscription: null,
          subscription_item: null
        }
      }
    }
  };

  return { ...defaultData, ...overrides };
}

// Helper functions for specific event types
export function createCheckoutSessionCompletedEvent(overrides?: Partial<any>): any {
  const data = create();
  return { ...data.checkoutSessionCompleted, ...overrides };
}

export function createPaymentIntentSucceededEvent(overrides?: Partial<any>): any {
  const data = create();
  return { ...data.paymentIntentSucceeded, ...overrides };
}

export function createPaymentMethodAttachedEvent(overrides?: Partial<any>): any {
  const data = create();
  return { ...data.paymentMethodAttached, ...overrides };
}

export function createPaymentMethodDetachedEvent(overrides?: Partial<any>): any {
  const data = create();
  return { ...data.paymentMethodDetached, ...overrides };
}

export function createCustomerDiscountCreatedEvent(overrides?: Partial<any>): any {
  const data = create();
  return { ...data.customerDiscountCreated, ...overrides };
}

// Helper for creating events with specific metadata
export function createPaymentIntentWithDiscount(originalAmount: number = 3000): any {
  return createPaymentIntentSucceededEvent({
    data: {
      object: {
        ...create().paymentIntentSucceeded.data.object,
        metadata: {
          original_amount: originalAmount.toString(),
          discount_applied: "true"
        }
      }
    }
  });
}

export function createPaymentIntentWithoutDiscount(): any {
  return createPaymentIntentSucceededEvent({
    data: {
      object: {
        ...create().paymentIntentSucceeded.data.object,
        metadata: {}
      }
    }
  });
}

export function createCustomerDiscountWithAmount(amountOff: number = 2000): any {
  return createCustomerDiscountCreatedEvent({
    data: {
      object: {
        ...create().customerDiscountCreated.data.object,
        coupon: {
          ...create().customerDiscountCreated.data.object.coupon,
          amount_off: amountOff
        }
      }
    }
  });
}
