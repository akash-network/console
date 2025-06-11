import { mock } from "jest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { StripeService } from "./stripe.service";

import { create as StripeSeederCreate } from "@test/seeders/stripe.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";

describe(StripeService.name, () => {
  describe("getStripeCustomerId", () => {
    it("returns existing user when stripeCustomerId exists", async () => {
      const { service } = setup();
      const userWithStripeId = UserSeeder.create({ stripeCustomerId: "cus_123" });
      const result = await service.getStripeCustomerId(userWithStripeId);
      expect(result).toEqual(userWithStripeId);
      expect(service.customers.create).not.toHaveBeenCalled();
    });

    it("creates new Stripe customer and updates user when no stripeCustomerId", async () => {
      const { service, userRepository } = setup();
      const user = UserSeeder.create({ stripeCustomerId: null });
      const result = await service.getStripeCustomerId(user);
      expect(service.customers.create).toHaveBeenCalledWith({
        email: user.email,
        name: user.username,
        metadata: { userId: user.userId }
      });
      expect(userRepository.updateBy).toHaveBeenCalledWith({ id: user.id, stripeCustomerId: null }, { stripeCustomerId: StripeSeederCreate().customer.id });
      expect(result).toEqual({
        ...user,
        stripeCustomerId: StripeSeederCreate().customer.id
      });
    });
  });

  describe("createPaymentIntent", () => {
    const mockPaymentParams = {
      customer: "cus_123",
      payment_method: "pm_123",
      amount: 100,
      currency: "usd",
      confirm: true
    };

    it("creates payment intent successfully", async () => {
      const { service } = setup();
      const result = await service.createPaymentIntent(mockPaymentParams);
      expect(service.paymentIntents.create).toHaveBeenCalledWith({
        customer: mockPaymentParams.customer,
        payment_method: mockPaymentParams.payment_method,
        amount: 10000,
        currency: mockPaymentParams.currency,
        confirm: mockPaymentParams.confirm,
        metadata: expect.any(Object),
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never"
        }
      });
      expect(result).toEqual({
        success: true,
        paymentIntentId: StripeSeederCreate().paymentIntent.id
      });
    });

    it("handles zero amount payment with discount", async () => {
      const { service, refillService, userRepository } = setup();
      // Create a user with a unique id and stripeCustomerId
      const user = UserSeeder.create({ id: "test-user-id-001", stripeCustomerId: "cus_123" });
      // Set lastUser in the mock context so findOneBy returns this user
      (userRepository as any).lastUser = user;
      // Patch the mock to use this lastUser
      userRepository.findOneBy.mockImplementation(async query => {
        if (query?.stripeCustomerId && user.stripeCustomerId === query.stripeCustomerId) {
          return user as any;
        }
        if (query?.id && user.id === query.id) {
          return user;
        }
        return null;
      });
      const stripeData = StripeSeederCreate();
      jest.spyOn(service, "getCustomerDiscounts").mockResolvedValue([
        {
          type: "promotion_code",
          id: stripeData.promotionCode.id,
          coupon_id: stripeData.promotionCode.coupon.id,
          code: stripeData.promotionCode.code,
          name: "50% off",
          percent_off: 100,
          valid: true
        }
      ]);

      const result = await service.createPaymentIntent({
        ...mockPaymentParams,
        amount: 100
      });

      expect(refillService.topUpWallet).toHaveBeenCalledWith(10000, user.id);
      expect(result).toEqual({
        success: true,
        paymentIntentId: "pi_zero_amount"
      });
    });
  });

  describe("getCustomerTransactions", () => {
    it("returns formatted transactions", async () => {
      const { service } = setup();
      const mockCharges = {
        data: [
          {
            id: "ch_123",
            amount: 1000,
            currency: "usd",
            status: "succeeded",
            created: 1234567890,
            payment_method_details: { type: "card" },
            receipt_url: "https://receipt.url",
            description: "Test charge",
            metadata: {}
          }
        ],
        has_more: false
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(mockCharges as any);

      const result = await service.getCustomerTransactions("cus_123");
      expect(result).toEqual({
        transactions: [
          {
            id: "ch_123",
            amount: 1000,
            currency: "usd",
            status: "succeeded",
            created: 1234567890,
            paymentMethod: { type: "card" },
            receiptUrl: "https://receipt.url",
            description: "Test charge",
            metadata: {}
          }
        ],
        hasMore: false,
        nextPage: "ch_123"
      });
    });
  });

  describe("applyCoupon", () => {
    it("applies promotion code successfully", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(stripeData.promotionCode as any);

      const result = await service.applyCoupon("cus_123", stripeData.promotionCode.code);
      expect(service.customers.update).toHaveBeenCalledWith("cus_123", {
        promotion_code: stripeData.promotionCode.id
      });
      expect(result).toEqual(stripeData.promotionCode);
    });

    it("throws error for invalid promotion code", async () => {
      const { service } = setup();
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(null as any);

      await expect(service.applyCoupon("cus_123", "INVALID")).rejects.toThrow("No valid promotion code or coupon found with the provided code");
    });
  });

  describe("createSetupIntent", () => {
    it("creates setup intent with correct parameters", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      jest.spyOn(service.setupIntents, "create").mockResolvedValue(stripeData.setupIntent as any);

      const result = await service.createSetupIntent("cus_123");
      expect(service.setupIntents.create).toHaveBeenCalledWith({
        customer: "cus_123",
        usage: "off_session"
      });
      expect(result).toEqual(stripeData.setupIntent);
    });
  });

  describe("startCheckoutSession", () => {
    it("creates checkout session with custom amount", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      const mockPrice = { id: "price_123", unit_amount: 2000 };

      jest.spyOn(service.prices, "list").mockResolvedValue({ data: [mockPrice] } as any);
      jest.spyOn(service.checkout.sessions, "create").mockResolvedValue(stripeData.checkoutSession as any);

      const result = await service.startCheckoutSession({
        customerId: "cus_123",
        redirectUrl: "https://return.url",
        amount: "20"
      });

      expect(service.checkout.sessions.create).toHaveBeenCalledWith({
        line_items: [{ price: "price_123", quantity: 1 }],
        mode: "payment",
        allow_promotion_codes: true,
        customer: "cus_123",
        success_url: "https://return.url?session_id={CHECKOUT_SESSION_ID}&payment-success=true",
        cancel_url: "https://return.url?session_id={CHECKOUT_SESSION_ID}&payment-canceled=true"
      });
      expect(result).toEqual(stripeData.checkoutSession);
    });

    it("creates checkout session without amount", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      const mockPrice = { id: "price_123", custom_unit_amount: true };

      jest.spyOn(service.prices, "list").mockResolvedValue({ data: [mockPrice] } as any);
      jest.spyOn(service.checkout.sessions, "create").mockResolvedValue(stripeData.checkoutSession as any);

      const result = await service.startCheckoutSession({
        customerId: "cus_123",
        redirectUrl: "https://return.url"
      });

      expect(service.checkout.sessions.create).toHaveBeenCalledWith({
        line_items: [{ price: "price_123", quantity: 1 }],
        mode: "payment",
        allow_promotion_codes: false,
        customer: "cus_123",
        success_url: "https://return.url?session_id={CHECKOUT_SESSION_ID}&payment-success=true",
        cancel_url: "https://return.url?session_id={CHECKOUT_SESSION_ID}&payment-canceled=true"
      });
      expect(result).toEqual(stripeData.checkoutSession);
    });

    it("throws error for invalid price", async () => {
      const { service } = setup();
      jest.spyOn(service.prices, "list").mockResolvedValue({ data: [] } as any);

      await expect(
        service.startCheckoutSession({
          customerId: "cus_123",
          redirectUrl: "https://return.url",
          amount: "20"
        })
      ).rejects.toThrow("Price invalid");
    });
  });

  describe("findPrices", () => {
    it("returns sorted prices", async () => {
      const { service } = setup();
      const mockPrices = [
        { custom_unit_amount: true, currency: "usd" },
        { unit_amount: 1000, currency: "usd" },
        { unit_amount: 2000, currency: "usd" }
      ];
      jest.spyOn(service.prices, "list").mockResolvedValue({ data: mockPrices } as any);

      const result = await service.findPrices();
      expect(result).toEqual([
        { unitAmount: undefined, isCustom: true, currency: "usd" },
        { unitAmount: 10, isCustom: false, currency: "usd" },
        { unitAmount: 20, isCustom: false, currency: "usd" }
      ]);
    });
  });

  describe("getPaymentMethods", () => {
    it("returns customer payment methods", async () => {
      const { service } = setup();
      const mockPaymentMethods = [
        { id: "pm_123", type: "card", card: { brand: "visa" } },
        { id: "pm_456", type: "card", card: { brand: "mastercard" } }
      ];
      jest.spyOn(service.paymentMethods, "list").mockResolvedValue({ data: mockPaymentMethods } as any);

      const result = await service.getPaymentMethods("cus_123");
      expect(service.paymentMethods.list).toHaveBeenCalledWith({
        customer: "cus_123",
        type: "card"
      });
      expect(result).toEqual(mockPaymentMethods);
    });
  });

  describe("listPromotionCodes", () => {
    it("returns promotion codes with expanded coupons", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      const mockPromotionCodes = [stripeData.promotionCode, { id: "promo_456", code: "TEST100", coupon: { id: "coupon_456" } }];
      jest.spyOn(service.promotionCodes, "list").mockResolvedValue({ data: mockPromotionCodes } as any);

      const result = await service.listPromotionCodes();
      expect(service.promotionCodes.list).toHaveBeenCalledWith({
        expand: ["data.coupon"]
      });
      expect(result).toEqual({ promotionCodes: mockPromotionCodes });
    });
  });

  describe("listCoupons", () => {
    it("returns coupons", async () => {
      const { service } = setup();
      const mockCoupons = [
        { id: "coupon_123", percent_off: 50 },
        { id: "coupon_456", amount_off: 1000 }
      ];
      jest.spyOn(service.coupons, "list").mockResolvedValue({ data: mockCoupons } as any);

      const result = await service.listCoupons();
      expect(service.coupons.list).toHaveBeenCalledWith({
        limit: 100
      });
      expect(result).toEqual({ coupons: mockCoupons });
    });
  });

  describe("getCoupon", () => {
    it("returns coupon by id", async () => {
      const { service } = setup();
      const mockCoupon = { id: "coupon_123", percent_off: 50 };
      jest.spyOn(service.coupons, "retrieve").mockResolvedValue(mockCoupon as any);

      const result = await service.getCoupon("coupon_123");
      expect(service.coupons.retrieve).toHaveBeenCalledWith("coupon_123");
      expect(result).toEqual(mockCoupon);
    });
  });

  describe("consumeActiveDiscount", () => {
    it("should consume active discount", async () => {
      const { service } = setup();
      const customerId = "cus_123";
      jest.spyOn(service, "getCustomerDiscounts").mockResolvedValue([
        {
          type: "promotion_code",
          id: "promo_1",
          coupon_id: "coupon_1",
          code: "PROMO123",
          name: "Promo",
          percent_off: 50,
          amount_off: null,
          currency: "usd",
          valid: true
        }
      ]);
      const result = await service.consumeActiveDiscount(customerId);
      expect(result).toBe(true);
      expect(service.customers.update).toHaveBeenCalledWith(customerId, { promotion_code: null });
    });

    it("should return false if no active discount", async () => {
      const { service } = setup();
      const customerId = "cus_123";
      jest.spyOn(service, "getCustomerDiscounts").mockResolvedValue([]);
      const result = await service.consumeActiveDiscount(customerId);
      expect(result).toBe(false);
      expect(service.customers.update).not.toHaveBeenCalled();
    });
  });
});

function setup() {
  const billingConfig = mock<BillingConfigService>({ get: jest.fn().mockReturnValue("test_key") });
  const userRepository = mock<UserRepository>();
  const refillService = mock<RefillService>();

  const service = new StripeService(billingConfig, userRepository, refillService);
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
    // fallback for tests that don't use UserSeeder
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

  // Mock Stripe methods
  jest.spyOn(service.customers, "create").mockResolvedValue(stripeData.customer as any);
  jest.spyOn(service.customers, "update").mockResolvedValue({} as any);
  jest.spyOn(service.customers, "retrieve").mockResolvedValue({} as any);
  jest.spyOn(service.paymentIntents, "create").mockResolvedValue(stripeData.paymentIntent as any);
  jest.spyOn(service.prices, "list").mockResolvedValue({ data: [] } as any);
  jest.spyOn(service.promotionCodes, "list").mockResolvedValue({ data: [] } as any);
  jest.spyOn(service.coupons, "list").mockResolvedValue({ data: [] } as any);
  jest.spyOn(service.charges, "list").mockResolvedValue({ data: [], has_more: false } as any);

  return {
    service,
    userRepository,
    refillService,
    billingConfig
  };
}
