import { faker } from "@faker-js/faker";
import { merge } from "lodash";
import type Stripe from "stripe";

import type { PaymentMethod } from "@src/billing/services/stripe/stripe.service";

type PaymentMethodOverrides = Omit<Partial<Stripe.PaymentMethod>, "card"> & {
  card?: Partial<Stripe.PaymentMethod.Card> | null;
};

export function generatePaymentMethod(overrides: PaymentMethodOverrides = {}): Stripe.PaymentMethod {
  const basePaymentMethod: Stripe.PaymentMethod = {
    id: faker.string.uuid(),
    object: "payment_method",
    type: "card",
    created: Math.floor(faker.date.recent().getTime() / 1000),
    customer: null,
    livemode: false,
    metadata: {},
    card: {
      brand: "Visa",
      last4: faker.finance.creditCardNumber().slice(-4),
      exp_month: faker.number.int({ min: 1, max: 12 }),
      exp_year: faker.number.int({ min: new Date().getFullYear(), max: new Date().getFullYear() + 5 }),
      funding: "credit",
      country: "US",
      networks: {
        available: ["visa"],
        preferred: "visa"
      },
      fingerprint: faker.string.uuid(),
      checks: null,
      display_brand: null,
      generated_from: null,
      three_d_secure_usage: null,
      wallet: null,
      regulated_status: null
    },
    billing_details: {
      address: {
        city: faker.location.city(),
        country: "US",
        line1: faker.location.streetAddress(),
        line2: null,
        postal_code: faker.location.zipCode(),
        state: faker.location.state()
      },
      email: faker.internet.email(),
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      tax_id: null
    }
  };

  return merge({}, basePaymentMethod, overrides);
}

export function generateMergedPaymentMethod(overrides: PaymentMethodOverrides & { validated?: boolean; isDefault?: boolean } = {}): PaymentMethod {
  const { validated, isDefault, ...stripeOverrides } = overrides;
  return merge({ validated: !!validated, isDefault: !!isDefault }, generatePaymentMethod(stripeOverrides));
}
