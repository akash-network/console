import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { UserRepository } from "@src/user/repositories";
import { StripeService } from "./stripe.service";

import { create as StripeSeederCreate } from "@test/seeders/stripe.seeder";
import { createTestInvoice, TEST_CONSTANTS } from "@test/seeders/stripe-test-data.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";

describe(StripeService.name, () => {
  describe("getStripeCustomerId", () => {
    it("returns existing user when stripeCustomerId exists", async () => {
      const { service, stripe } = setup();
      const userWithStripeId = createTestUser();
      const result = await service.getStripeCustomerId(userWithStripeId);
      expect(result).toEqual(userWithStripeId.stripeCustomerId);
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("creates new Stripe customer and updates user when no stripeCustomerId", async () => {
      const { service, stripe, userRepository } = setup();
      const user = createTestUser({ stripeCustomerId: null });
      const result = await service.getStripeCustomerId(user);
      expect(stripe.customers.create).toHaveBeenCalledWith(
        {
          email: user.email,
          name: user.username,
          metadata: { userId: user.id }
        },
        { idempotencyKey: `create-customer:${user.id}` }
      );
      expect(userRepository.updateBy).toHaveBeenCalledWith(
        { id: user.id, stripeCustomerId: null },
        { stripeCustomerId: StripeSeederCreate().customer.id },
        { returning: true }
      );
      expect(result).toEqual(StripeSeederCreate().customer.id);
    });
  });

  describe("createSetupIntent", () => {
    it("creates setup intent with correct parameters when not a free trial", async () => {
      const { service, stripe } = setup();
      const stripeData = StripeSeederCreate();
      vi.spyOn(stripe.setupIntents, "create").mockResolvedValue(stripeData.setupIntent);

      const result = await service.createSetupIntent(TEST_CONSTANTS.CUSTOMER_ID, { isFreeTrial: false });
      expect(stripe.setupIntents.create).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
        usage: "off_session",
        payment_method_types: ["card", "link"]
      });
      expect(result).toEqual(stripeData.setupIntent);
    });

    it("creates setup intent with free trial metadata when user is trialing", async () => {
      const { service, stripe } = setup();
      const stripeData = StripeSeederCreate();
      vi.spyOn(stripe.setupIntents, "create").mockResolvedValue(stripeData.setupIntent);

      const result = await service.createSetupIntent(TEST_CONSTANTS.CUSTOMER_ID, { isFreeTrial: true });
      expect(stripe.setupIntents.create).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
        usage: "off_session",
        payment_method_types: ["card", "link"],
        metadata: { is_free_trial: "true" }
      });
      expect(result).toEqual(stripeData.setupIntent);
    });
  });

  describe("findPrices", () => {
    it("returns sorted prices", async () => {
      const { service, stripe } = setup();
      const mockPrices = [
        { custom_unit_amount: true, currency: "usd" },
        { unit_amount: 1000, currency: "usd" },
        { unit_amount: 2000, currency: "usd" }
      ];
      vi.spyOn(stripe.prices, "list").mockResolvedValue({ data: mockPrices } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Price>>);

      const result = await service.findPrices();
      expect(result).toEqual([
        { unitAmount: 10, isCustom: false, currency: "usd" },
        { unitAmount: 20, isCustom: false, currency: "usd" },
        { unitAmount: undefined, isCustom: true, currency: "usd" }
      ]);
    });
  });

  describe("listPromotionCodes", () => {
    it("returns promotion codes with expanded coupons", async () => {
      const { service, stripe } = setup();
      const stripeData = StripeSeederCreate();
      const mockPromotionCodes = [stripeData.promotionCode, { id: "promo_456", code: "TEST100", coupon: { id: "coupon_456" } }];
      vi.spyOn(stripe.promotionCodes, "list").mockResolvedValue({ data: mockPromotionCodes } as unknown as Stripe.Response<
        Stripe.ApiList<Stripe.PromotionCode>
      >);

      const result = await service.listPromotionCodes();
      expect(stripe.promotionCodes.list).toHaveBeenCalledWith({
        expand: ["data.promotion.coupon"]
      });
      expect(result).toEqual({ promotionCodes: mockPromotionCodes });
    });
  });

  describe("getCoupon", () => {
    it("returns coupon by id", async () => {
      const { service, stripe } = setup();
      const mockCoupon = { id: TEST_CONSTANTS.COUPON_ID, percent_off: 50 };
      vi.spyOn(stripe.coupons, "retrieve").mockResolvedValue(mockCoupon as unknown as Stripe.Response<Stripe.Coupon>);

      const result = await service.getCoupon(TEST_CONSTANTS.COUPON_ID);
      expect(stripe.coupons.retrieve).toHaveBeenCalledWith(TEST_CONSTANTS.COUPON_ID);
      expect(result).toEqual(mockCoupon);
    });
  });

  describe("Stripe SDK primitive wrappers", () => {
    it("retrievePaymentMethod delegates to the Stripe payment-methods API", async () => {
      const { service, stripe } = setup();
      const paymentMethod = mock<Stripe.Response<Stripe.PaymentMethod>>({ id: "pm_1" });
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(paymentMethod);

      const result = await service.retrievePaymentMethod("pm_1");

      expect(stripe.paymentMethods.retrieve).toHaveBeenCalledWith("pm_1");
      expect(result).toBe(paymentMethod);
    });

    it("detachPaymentMethod delegates to the Stripe payment-methods API", async () => {
      const { service, stripe } = setup();
      const paymentMethod = mock<Stripe.Response<Stripe.PaymentMethod>>({ id: "pm_1" });
      vi.spyOn(stripe.paymentMethods, "detach").mockResolvedValue(paymentMethod);

      const result = await service.detachPaymentMethod("pm_1");

      expect(stripe.paymentMethods.detach).toHaveBeenCalledWith("pm_1");
      expect(result).toBe(paymentMethod);
    });

    it("retrieveCharge delegates to the Stripe charges API", async () => {
      const { service, stripe } = setup();
      const charge = mock<Stripe.Response<Stripe.Charge>>({ id: "ch_1" });
      vi.spyOn(stripe.charges, "retrieve").mockResolvedValue(charge);

      const result = await service.retrieveCharge("ch_1");

      expect(stripe.charges.retrieve).toHaveBeenCalledWith("ch_1");
      expect(result).toBe(charge);
    });

    it("constructWebhookEvent verifies the signature with the configured webhook secret", () => {
      const { service, stripe, billingConfig } = setup();
      const webhookSecret = `whsec_${faker.string.alphanumeric(32)}`;
      billingConfig.get.mockReturnValue(webhookSecret);
      const event = mock<Stripe.Event>({ id: "evt_1" });
      vi.spyOn(stripe.webhooks, "constructEvent").mockReturnValue(event);

      const result = service.constructWebhookEvent("raw-body", "sig-header");

      expect(billingConfig.get).toHaveBeenCalledWith("STRIPE_WEBHOOK_SECRET");
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith("raw-body", "sig-header", webhookSecret);
      expect(result).toBe(event);
    });
  });
});

function setup(
  params: {
    user?: ReturnType<typeof createTestUser> | null;
    paymentIntent?: Stripe.Response<Stripe.PaymentIntent>;
  } = {}
) {
  const billingConfig = mock<BillingConfigService>({ get: vi.fn().mockReturnValue("sk_live_key") });
  const userRepository = mock<UserRepository>();

  const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });

  const service = new StripeService(billingConfig, userRepository, stripe, () => mock<LoggerService>());

  const stripeData = StripeSeederCreate();

  // Store the last user for correct mocking
  let lastUser: any = null;
  userRepository.findOneBy.mockImplementation(async query => {
    if (query?.stripeCustomerId && lastUser && lastUser.stripeCustomerId === query.stripeCustomerId) {
      return lastUser;
    }
    if (query?.id && lastUser && lastUser.id === query.id) {
      return lastUser;
    }
    // fallback for tests that don't use createUser
    if (query?.stripeCustomerId) {
      return { id: query.stripeCustomerId, stripeCustomerId: query.stripeCustomerId };
    }
    if (query?.id) {
      return { id: query.id, stripeCustomerId: null };
    }
    return null;
  });
  userRepository.updateBy.mockImplementation(async (query, update) => {
    if (lastUser && lastUser.id === query.id) {
      lastUser = { ...lastUser, ...update };
      return lastUser;
    }
    // If no lastUser, create a new one with the update
    if (query.id) {
      lastUser = { id: query.id, ...update };
      return lastUser;
    }
    return null;
  });

  // Setup user repository mock based on parameters
  const userToReturn = "user" in params ? params.user : createTestUser();
  vi.spyOn(userRepository, "findOneBy").mockResolvedValue(userToReturn ?? undefined);

  // Mock Stripe methods
  vi.spyOn(stripe.customers, "create").mockResolvedValue(stripeData.customer);
  vi.spyOn(stripe.customers, "update").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Customer>);
  vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Customer>);
  // Setup payment intent mock based on parameters
  const paymentIntentToReturn = params.paymentIntent || stripeData.paymentIntent;
  vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue(paymentIntentToReturn);
  vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(paymentIntentToReturn);
  vi.spyOn(stripe.prices, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Price>>);
  vi.spyOn(stripe.promotionCodes, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>);
  vi.spyOn(stripe.coupons, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);
  vi.spyOn(stripe.coupons, "retrieve").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Coupon>);
  vi.spyOn(stripe.charges, "list").mockResolvedValue({ data: [], has_more: false } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>);
  vi.spyOn(stripe.refunds, "create").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Refund>);
  vi.spyOn(stripe.refunds, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Refund>>);
  vi.spyOn(stripe.setupIntents, "create").mockResolvedValue(stripeData.setupIntent);
  vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
  vi.spyOn(stripe.invoices, "create").mockResolvedValue(createTestInvoice());
  vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ status: "paid" }));
  vi.spyOn(stripe.invoices, "voidInvoice").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Invoice>);
  vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue({} as unknown as Stripe.Response<Stripe.InvoiceItem>);

  return {
    service,
    stripe,
    userRepository,
    billingConfig
  };
}
