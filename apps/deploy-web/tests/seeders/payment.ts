import { faker } from "@faker-js/faker";

export const createMockPaymentMethod = (overrides = {}) => ({
  id: `pm_${faker.string.alphanumeric(24)}`,
  type: "card",
  card: {
    brand: faker.helpers.arrayElement(["visa", "mastercard", "amex"]),
    last4: faker.string.numeric(4),
    exp_month: faker.number.int({ min: 1, max: 12 }),
    exp_year: faker.number.int({ min: 2024, max: 2030 }),
    fingerprint: faker.string.alphanumeric(16)
  },
  billing_details: {
    name: faker.person.fullName(),
    email: faker.internet.email()
  },
  ...overrides
});

export const createMockDiscount = (overrides = {}) => ({
  id: `di_${faker.string.alphanumeric(24)}`,
  coupon: {
    id: faker.helpers.arrayElement(["25OFF", "WELCOME10", "SUMMER20"]),
    percent_off: faker.helpers.arrayElement([10, 15, 20, 25]),
    duration: faker.helpers.arrayElement(["forever", "once", "repeating"]),
    name: faker.helpers.arrayElement(["25% Off Forever", "Welcome 10% Off", "Summer 20% Off"])
  },
  start: faker.date.past().getTime(),
  end: faker.helpers.maybe(() => faker.date.future().getTime(), { probability: 0.5 }),
  ...overrides
});

export const createMockTransaction = (overrides = {}) => ({
  id: `pi_${faker.string.alphanumeric(24)}`,
  amount: faker.number.int({ min: 1000, max: 10000 }),
  currency: "usd",
  status: faker.helpers.arrayElement(["succeeded", "pending", "failed"]),
  payment_method: createMockPaymentMethod(),
  created: faker.date.past().getTime(),
  description: faker.helpers.arrayElement(["Monthly subscription", "One-time purchase", "Annual plan"]),
  ...overrides
});

export const createMockSetupIntent = (overrides = {}) => ({
  id: `seti_${faker.string.alphanumeric(24)}`,
  client_secret: `seti_${faker.string.alphanumeric(24)}_secret_${faker.string.alphanumeric(9)}`,
  status: "requires_payment_method",
  payment_method_types: ["card"],
  created: faker.date.past().getTime(),
  ...overrides
});

export const createMockPaymentResponse = (overrides = {}) => ({
  id: `pi_${faker.string.alphanumeric(24)}`,
  status: "succeeded",
  amount: faker.number.int({ min: 100, max: 1000 }),
  currency: "usd",
  ...overrides
});

export const createMockCouponResponse = (overrides = {}) => ({
  coupon: {
    id: faker.helpers.arrayElement(["25OFF", "WELCOME10", "SUMMER20"]),
    percent_off: faker.helpers.arrayElement([10, 15, 20, 25]),
    valid: true,
    name: faker.helpers.arrayElement(["25% Off Forever", "Welcome 10% Off", "Summer 20% Off"])
  },
  amountAdded: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
  ...overrides
});

export const createMockRemovedPaymentMethod = (overrides = {}) => ({
  id: `pm_${faker.string.alphanumeric(24)}`,
  deleted: true,
  ...overrides
});

// Helper to create multiple items
export const createMockItems = (creator: (overrides?: any) => any, count: number, overrides = {}) => Array.from({ length: count }, () => creator(overrides));
