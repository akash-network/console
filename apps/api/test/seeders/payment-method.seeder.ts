import { faker } from "@faker-js/faker";

import type { PaymentMethod } from "@src/billing/types/payment-method.type";

type PaymentMethodInput = {
  type?: string;
  cardBrand?: string | null;
  cardLast4?: string;
};

export function generatePaymentMethod(input: PaymentMethodInput = {}): PaymentMethod {
  return {
    id: faker.string.uuid(),
    type: input.type || faker.finance.transactionType(),
    card: {
      brand: input.cardBrand || faker.helpers.arrayElement(["Visa", "MasterCard", "American Express", null]),
      last4: input.cardLast4 || faker.finance.creditCardNumber().slice(-4),
      exp_month: faker.number.int({ min: 1, max: 12 }),
      exp_year: faker.number.int({ min: new Date().getFullYear(), max: new Date().getFullYear() + 5 }),
      funding: faker.helpers.arrayElement(["credit", "debit", null]),
      country: faker.location.countryCode(),
      network: faker.helpers.arrayElement(["Visa", "MasterCard", "American Express", null]),
      fingerprint: faker.string.uuid()
    },
    billing_details: {
      address: {
        city: faker.location.city(),
        country: faker.location.countryCode(),
        line1: faker.location.streetAddress(),
        line2: faker.datatype.boolean() ? faker.location.secondaryAddress() : null,
        postal_code: faker.location.zipCode(),
        state: faker.location.state()
      },
      email: faker.internet.email(),
      name: faker.person.fullName(),
      phone: faker.phone.number()
    }
  };
}
