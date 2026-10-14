import { faker } from "@faker-js/faker";
import type Stripe from "stripe";

export function createStripeCustomer(overrides: Partial<Stripe.Customer> = {}): Stripe.Response<Stripe.Customer> {
  return withLastResponse({
    id: `cus_${faker.string.alphanumeric(14)}`,
    object: "customer",
    address: createStripeAddress(),
    balance: 0,
    created: faker.date.past().getTime(),
    default_source: null,
    description: null,
    email: faker.internet.email(),
    invoice_settings: { custom_fields: null, default_payment_method: null, footer: null, rendering_options: null },
    livemode: false,
    metadata: {},
    name: faker.company.name(),
    shipping: null,
    ...overrides
  });
}

export function createStripeAddress(overrides: Partial<Stripe.Address> = {}): Stripe.Address {
  return {
    line1: faker.location.streetAddress(),
    line2: faker.location.secondaryAddress(),
    city: faker.location.city(),
    state: faker.location.state(),
    postal_code: faker.location.zipCode(),
    country: faker.location.countryCode(),
    ...overrides
  };
}

export function createStripeTaxId(overrides: Partial<Stripe.TaxId> = {}): Stripe.Response<Stripe.TaxId> {
  return withLastResponse({
    id: `txi_${faker.string.alphanumeric(14)}`,
    object: "tax_id",
    country: "DE",
    created: faker.date.past().getTime(),
    customer: `cus_${faker.string.alphanumeric(14)}`,
    livemode: false,
    owner: null,
    type: "eu_vat",
    value: `DE${faker.string.numeric(9)}`,
    verification: { status: "verified", verified_address: null, verified_name: null },
    ...overrides
  });
}

function withLastResponse<T>(data: T): Stripe.Response<T> {
  return { ...data, lastResponse: { headers: {}, requestId: `req_${faker.string.alphanumeric(14)}`, statusCode: 200 } };
}
