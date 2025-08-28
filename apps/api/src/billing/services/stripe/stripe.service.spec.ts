import { mock } from "jest-mock-extended";
import type Stripe from "stripe";

import type { PaymentMethodRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { UserRepository } from "@src/user/repositories";
import { StripeService } from "./stripe.service";

import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { create as StripeSeederCreate } from "@test/seeders/stripe.seeder";
import { StripeTransactionSeeder } from "@test/seeders/stripe-transaction.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { stub } from "@test/services/stub";

describe(StripeService.name, () => {
  describe("getStripeCustomerId", () => {
    it("returns existing user when stripeCustomerId exists", async () => {
      const { service } = setup();
      const userWithStripeId = UserSeeder.create({ stripeCustomerId: "cus_123" });
      const result = await service.getStripeCustomerId(userWithStripeId);
      expect(result).toEqual(userWithStripeId.stripeCustomerId);
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
      expect(userRepository.updateBy).toHaveBeenCalledWith(
        { id: user.id, stripeCustomerId: null },
        { stripeCustomerId: StripeSeederCreate().customer.id },
        { returning: true }
      );
      expect(result).toEqual(StripeSeederCreate().customer.id);
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
      jest.spyOn(userRepository, "findOneBy").mockResolvedValue(user);
      // Patch the mock to use this lastUser
      userRepository.findOneBy.mockImplementation(async query => {
        if (query?.stripeCustomerId && user.stripeCustomerId === query.stripeCustomerId) {
          return user;
        }
        if (query?.id && user.id === query.id) {
          return user;
        }
        return undefined;
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

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

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
        nextPage: "ch_123",
        prevPage: null
      });
    });

    it("calls charges.list with endingBefore parameter", async () => {
      const { service } = setup();
      const mockCharges = {
        data: [
          {
            id: "ch_456",
            amount: 2000,
            currency: "usd",
            status: "succeeded",
            created: 1234567890,
            payment_method_details: { type: "card" },
            receipt_url: "https://receipt.url",
            description: "Test charge",
            metadata: {}
          }
        ],
        has_more: true
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      await service.getCustomerTransactions("cus_123", {
        endingBefore: "ch_before_id",
        limit: 50
      });

      expect(service.charges.list).toHaveBeenCalledWith({
        customer: "cus_123",
        limit: 50,
        created: undefined,
        starting_after: undefined,
        ending_before: "ch_before_id",
        expand: ["data.payment_intent"]
      });
    });

    it("calls charges.list with created parameter", async () => {
      const { service } = setup();
      const mockCharges = {
        data: [
          {
            id: "ch_789",
            amount: 3000,
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

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      const startDate = new Date("2022-01-01T00:00:00Z").toISOString();
      const endDate = new Date("2022-12-31T23:59:59Z").toISOString();
      await service.getCustomerTransactions("cus_123", {
        startDate,
        endDate,
        limit: 25
      });

      expect(service.charges.list).toHaveBeenCalledWith({
        customer: "cus_123",
        limit: 25,
        created: {
          gte: new Date(startDate).getTime() / 1000,
          lte: new Date(endDate).getTime() / 1000
        },
        starting_after: undefined,
        ending_before: undefined,
        expand: ["data.payment_intent"]
      });
    });

    it("returns correct prevPage when startingAfter is provided", async () => {
      const { service } = setup();
      const mockCharges = {
        data: [
          {
            id: "ch_first",
            amount: 1000,
            currency: "usd",
            status: "succeeded",
            created: 1234567890,
            payment_method_details: { type: "card" },
            receipt_url: "https://receipt.url",
            description: "First charge",
            metadata: {}
          },
          {
            id: "ch_second",
            amount: 2000,
            currency: "usd",
            status: "succeeded",
            created: 1234567891,
            payment_method_details: { type: "card" },
            receipt_url: "https://receipt.url",
            description: "Second charge",
            metadata: {}
          }
        ],
        has_more: true
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      const result = await service.getCustomerTransactions("cus_123", {
        startingAfter: "ch_previous_id"
      });

      expect(result).toEqual({
        transactions: [
          {
            id: "ch_first",
            amount: 1000,
            currency: "usd",
            status: "succeeded",
            created: 1234567890,
            paymentMethod: { type: "card" },
            receiptUrl: "https://receipt.url",
            description: "First charge",
            metadata: {}
          },
          {
            id: "ch_second",
            amount: 2000,
            currency: "usd",
            status: "succeeded",
            created: 1234567891,
            paymentMethod: { type: "card" },
            receiptUrl: "https://receipt.url",
            description: "Second charge",
            metadata: {}
          }
        ],
        hasMore: true,
        nextPage: "ch_second",
        prevPage: "ch_first"
      });
    });

    it("returns null prevPage when startingAfter is not provided", async () => {
      const { service } = setup();
      const mockCharges = {
        data: [
          {
            id: "ch_only",
            amount: 1000,
            currency: "usd",
            status: "succeeded",
            created: 1234567890,
            payment_method_details: { type: "card" },
            receipt_url: "https://receipt.url",
            description: "Only charge",
            metadata: {}
          }
        ],
        has_more: false
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      const result = await service.getCustomerTransactions("cus_123");

      expect(result.prevPage).toBeNull();
    });

    it("calls charges.list with all parameters combined", async () => {
      const { service } = setup();
      const mockCharges: {
        data: Stripe.Charge[];
        has_more: boolean;
      } = {
        data: [],
        has_more: false
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      const startDate = new Date("2021-01-01T00:00:00Z").toISOString();
      const endDate = new Date("2021-12-31T23:59:59Z").toISOString();

      const options = {
        limit: 10,
        startingAfter: "ch_start_id",
        endingBefore: "ch_end_id",
        startDate,
        endDate
      };

      await service.getCustomerTransactions("cus_123", options);

      expect(service.charges.list).toHaveBeenCalledWith({
        customer: "cus_123",
        limit: 10,
        created: {
          gte: new Date(startDate).getTime() / 1000,
          lte: new Date(endDate).getTime() / 1000
        },
        starting_after: "ch_start_id",
        ending_before: "ch_end_id",
        expand: ["data.payment_intent"]
      });
    });
  });

  describe("exportTransactionsCsvStream", () => {
    it("streams transactions for a single page", async () => {
      const { service } = setup();
      const mockTransactions = [
        StripeTransactionSeeder.create({
          id: "ch_123",
          amount: 1000,
          created: 1640995200,
          paymentMethod: generatePaymentMethod({
            type: "card",
            cardBrand: "visa",
            cardLast4: "4242"
          })
        })
      ];

      jest.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: mockTransactions,
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream("cus_123", {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks = await Array.fromAsync(csvStream);

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain("Transaction ID,Date (America/New_York),Amount,Currency,Status,Payment Method,Card Brand,Card Last 4,Description,Receipt URL");

      expect(fullCsv).toContain("ch_123");
      expect(fullCsv).toContain("2021-12-31, 7:00:00 p.m.");
      expect(fullCsv).toContain("10.00");
      expect(fullCsv).toContain("visa");
      expect(fullCsv).toContain("4242");
    });

    it("streams multiple pages without loading all into memory", async () => {
      const { service } = setup();

      const firstPageTransactions = [
        StripeTransactionSeeder.create({
          id: "ch_001",
          amount: 1000,
          created: 1640995200,
          paymentMethod: generatePaymentMethod({
            type: "card",
            cardBrand: "visa",
            cardLast4: "1111"
          }),
          description: "First transaction"
        })
      ];

      const secondPageTransactions = [
        StripeTransactionSeeder.create({
          id: "ch_002",
          amount: 2000,
          created: 1641081600,
          paymentMethod: generatePaymentMethod({
            type: "card",
            cardBrand: "mastercard",
            cardLast4: "2222"
          }),
          description: "Second transaction"
        })
      ];

      jest
        .spyOn(service, "getCustomerTransactions")
        .mockResolvedValueOnce({
          transactions: firstPageTransactions,
          hasMore: true,
          nextPage: "ch_001",
          prevPage: null
        })
        .mockResolvedValueOnce({
          transactions: secondPageTransactions,
          hasMore: false,
          nextPage: null,
          prevPage: "ch_002"
        });

      const csvStream = service.exportTransactionsCsvStream("cus_123", {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks = await Array.fromAsync(csvStream);

      const fullCsv = chunks.join("");

      expect(service.getCustomerTransactions).toHaveBeenCalledTimes(2);
      expect(service.getCustomerTransactions).toHaveBeenNthCalledWith(1, "cus_123", {
        limit: 100,
        startingAfter: undefined,
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z"
      });
      expect(service.getCustomerTransactions).toHaveBeenNthCalledWith(2, "cus_123", {
        limit: 100,
        startingAfter: "ch_001",
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z"
      });

      expect(fullCsv).toContain("ch_001");
      expect(fullCsv).toContain("ch_002");
      expect(fullCsv).toContain("First transaction");
      expect(fullCsv).toContain("Second transaction");
    });

    it("returns message when no transactions found", async () => {
      const { service } = setup();

      jest.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [],
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream("cus_123", {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks = await Array.fromAsync(csvStream);

      const fullCsv = chunks.join("");
      expect(fullCsv).toContain("No transactions found for the specified date range");
    });

    it("handles transactions with null payment methods", async () => {
      const { service } = setup();
      const mockTransactions = [
        StripeTransactionSeeder.create({
          id: "ch_123",
          amount: 1000,
          currency: "usd",
          status: "succeeded",
          created: 1640995200,
          paymentMethod: null,
          receiptUrl: null,
          description: "No payment method"
        })
      ];

      jest.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: mockTransactions,
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream("cus_123", {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks = await Array.fromAsync(csvStream);

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain("ch_123");
      expect(fullCsv).toContain("No payment method");
      expect(fullCsv).toMatch(/ch_123,"[^"]*",[^,]*,[^,]*,[^,]*,,,,No payment method,/);
    });
  });

  describe("applyCoupon", () => {
    it("applies promotion code successfully and tops up wallet", async () => {
      const { service, refillService } = setup();
      const stripeData = StripeSeederCreate();
      const mockUser = UserSeeder.create({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPromotionCode = {
        ...stripeData.promotionCode,
        coupon: {
          ...stripeData.promotionCode.coupon,
          amount_off: 1000,
          percent_off: null as any,
          valid: true
        }
      };
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(stub(mockPromotionCode));
      refillService.topUpWallet.mockResolvedValue();

      const result = await service.applyCoupon(mockUser, mockPromotionCode.code);

      expect(refillService.topUpWallet).toHaveBeenCalledWith(1000, "user_123");
      expect(service.customers.update).toHaveBeenCalledTimes(2);
      expect(service.customers.update).toHaveBeenNthCalledWith(1, "cus_123", {
        promotion_code: mockPromotionCode.id
      });
      expect(service.customers.update).toHaveBeenNthCalledWith(2, "cus_123", {
        promotion_code: null
      });
      expect(result).toEqual({
        coupon: mockPromotionCode,
        amountAdded: 10 // 1000 cents = $10
      });
    });

    it("rejects percentage-based promotion codes", async () => {
      const { service } = setup();
      const mockUser = UserSeeder.create({ stripeCustomerId: "cus_123" });
      const stripeData = StripeSeederCreate();
      const mockPromotionCode = {
        ...stripeData.promotionCode,
        coupon: {
          ...stripeData.promotionCode.coupon,
          percent_off: 20,
          amount_off: null as any,
          valid: true
        }
      };
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode as any);

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );
    });

    it("rejects promotion codes without amount_off", async () => {
      const { service } = setup();
      const mockUser = UserSeeder.create({ stripeCustomerId: "cus_123" });
      const stripeData = StripeSeederCreate();
      const mockPromotionCode = {
        ...stripeData.promotionCode,
        coupon: {
          ...stripeData.promotionCode.coupon,
          percent_off: null as any,
          amount_off: null as any,
          valid: true
        }
      };
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode as any);

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("rejects percentage-based coupons", async () => {
      const { service } = setup();
      const mockUser = UserSeeder.create({ stripeCustomerId: "cus_123" });
      const stripeData = StripeSeederCreate();
      const mockCoupon = {
        ...stripeData.promotionCode.coupon,
        percent_off: 20,
        amount_off: null as any,
        valid: true
      };
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(null as any);
      jest.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] } as any);

      await expect(service.applyCoupon(mockUser, mockCoupon.id)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );
    });

    it("rejects coupons without amount_off", async () => {
      const { service } = setup();
      const mockUser = UserSeeder.create({ stripeCustomerId: "cus_123" });
      const stripeData = StripeSeederCreate();
      const mockCoupon = {
        ...stripeData.promotionCode.coupon,
        percent_off: null as any,
        amount_off: null as any,
        valid: true
      };
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(null as any);
      jest.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] } as any);

      await expect(service.applyCoupon(mockUser, mockCoupon.id)).rejects.toThrow("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("throws error for invalid promotion code", async () => {
      const { service } = setup();
      const mockUser = UserSeeder.create({ stripeCustomerId: "cus_123" });
      jest.spyOn(service.promotionCodes, "list").mockResolvedValue(stub({ data: [] }));
      jest.spyOn(service.coupons, "list").mockResolvedValue(stub({ data: [] }));

      await expect(service.applyCoupon(mockUser, "INVALID_CODE")).rejects.toThrow("No valid promotion code or coupon found with the provided code");
    });

    it("rolls back coupon application when topUpWallet fails", async () => {
      const { service, refillService } = setup();
      // Use a fixed-amount coupon, not a percent-off
      const basePromotionCode = StripeSeederCreate().promotionCode;
      const mockPromotionCode = {
        ...basePromotionCode,
        coupon: { ...basePromotionCode.coupon, amount_off: 1000, percent_off: null as number | null, valid: true }
      };
      const mockUser = UserSeeder.create({ stripeCustomerId: "cus_123" });

      jest.spyOn(service.promotionCodes, "list").mockResolvedValue({ data: [mockPromotionCode] } as any);
      jest.spyOn(service.customers, "update").mockResolvedValue({} as any);

      // Mock topUpWallet to fail
      refillService.topUpWallet.mockRejectedValue(new Error("Wallet top-up failed"));

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow("Wallet top-up failed");

      // Verify that the coupon was applied and then rolled back
      expect(service.customers.update).toHaveBeenCalledTimes(2);
      expect(service.customers.update).toHaveBeenNthCalledWith(1, "cus_123", {
        promotion_code: mockPromotionCode.id
      });
      expect(service.customers.update).toHaveBeenNthCalledWith(2, "cus_123", {
        promotion_code: null
      });
    });
  });

  describe("createSetupIntent", () => {
    it("creates setup intent with correct parameters", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      jest.spyOn(service.setupIntents, "create").mockResolvedValue(stub(stripeData.setupIntent));

      const result = await service.createSetupIntent("cus_123");
      expect(service.setupIntents.create).toHaveBeenCalledWith({
        customer: "cus_123",
        usage: "off_session",
        payment_method_types: ["card", "link"]
      });
      expect(result).toEqual(stripeData.setupIntent);
    });
  });

  describe("startCheckoutSession", () => {
    it("creates checkout session with custom amount", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      const mockPrice = { id: "price_123", unit_amount: 2000 };

      jest.spyOn(service.prices, "list").mockResolvedValue(stub({ data: [mockPrice] }));
      jest.spyOn(service.checkout.sessions, "create").mockResolvedValue(stub(stripeData.checkoutSession));

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

      jest.spyOn(service.prices, "list").mockResolvedValue(stub({ data: [mockPrice] }));
      jest.spyOn(service.checkout.sessions, "create").mockResolvedValue(stub(stripeData.checkoutSession));

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
      jest.spyOn(service.prices, "list").mockResolvedValue(stub({ data: [] }));

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
      jest.spyOn(service.prices, "list").mockResolvedValue(stub({ data: mockPrices }));

      const result = await service.findPrices();
      expect(result).toEqual([
        { unitAmount: 10, isCustom: false, currency: "usd" },
        { unitAmount: 20, isCustom: false, currency: "usd" },
        { unitAmount: undefined, isCustom: true, currency: "usd" }
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
      jest.spyOn(service.paymentMethods, "list").mockResolvedValue(stub({ data: mockPaymentMethods }));

      const result = await service.getPaymentMethods("cus_123");
      expect(service.paymentMethods.list).toHaveBeenCalledWith({
        customer: "cus_123"
      });
      expect(result).toEqual(mockPaymentMethods);
    });
  });

  describe("listPromotionCodes", () => {
    it("returns promotion codes with expanded coupons", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      const mockPromotionCodes = [stripeData.promotionCode, { id: "promo_456", code: "TEST100", coupon: { id: "coupon_456" } }];
      jest.spyOn(service.promotionCodes, "list").mockResolvedValue(stub({ data: mockPromotionCodes }));

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
      jest.spyOn(service.coupons, "list").mockResolvedValue(stub({ data: mockCoupons }));

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
      jest.spyOn(service.coupons, "retrieve").mockResolvedValue(stub(mockCoupon));

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

  describe("hasDuplicateTrialAccount", () => {
    it("should return true when duplicate payment method fingerprints are found", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = "user_123";
      const paymentMethods = [
        {
          id: "pm_1",
          type: "card",
          card: { fingerprint: "fp_123" }
        },
        {
          id: "pm_2",
          type: "card",
          card: { fingerprint: "fp_456" }
        }
      ] as Stripe.PaymentMethod[];

      paymentMethodRepository.findOtherByFingerprint.mockResolvedValue({
        id: "existing_pm",
        userId: "other_user",
        fingerprint: "fp_123",
        paymentMethodId: "pm_existing",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(true);
      expect(paymentMethodRepository.findOtherByFingerprint).toHaveBeenCalledWith(["fp_123", "fp_456"], currentUserId);
    });

    it("should return false when no duplicate payment method fingerprints are found", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = "user_123";
      const paymentMethods = [
        {
          id: "pm_1",
          type: "card",
          card: { fingerprint: "fp_123" }
        }
      ] as Stripe.PaymentMethod[];

      paymentMethodRepository.findOtherByFingerprint.mockResolvedValue(undefined);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOtherByFingerprint).toHaveBeenCalledWith(["fp_123"], currentUserId);
    });

    it("should filter out payment methods without fingerprints", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = "user_123";
      const paymentMethods = [
        {
          id: "pm_1",
          type: "card",
          card: { fingerprint: "fp_123" }
        },
        {
          id: "pm_2",
          type: "card",
          card: null
        },
        {
          id: "pm_3",
          type: "card",
          card: { fingerprint: undefined }
        }
      ] as Stripe.PaymentMethod[];

      paymentMethodRepository.findOtherByFingerprint.mockResolvedValue(undefined);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOtherByFingerprint).toHaveBeenCalledWith(["fp_123"], currentUserId);
    });

    it("should handle empty payment methods array", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = "user_123";
      const paymentMethods: Stripe.PaymentMethod[] = [];

      paymentMethodRepository.findOtherByFingerprint.mockResolvedValue(undefined);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOtherByFingerprint).toHaveBeenCalledWith([], currentUserId);
    });
  });
});

function setup() {
  const billingConfig = mock<BillingConfigService>({ get: jest.fn().mockReturnValue("test_key") });
  const userRepository = mock<UserRepository>();
  const refillService = mock<RefillService>();
  const paymentMethodRepository = mock<PaymentMethodRepository>();

  const service = new StripeService(billingConfig, userRepository, refillService, paymentMethodRepository);
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
  jest.spyOn(service.customers, "create").mockResolvedValue(stub(stripeData.customer));
  jest.spyOn(service.customers, "update").mockResolvedValue(stub({}));
  jest.spyOn(service.customers, "retrieve").mockResolvedValue(stub({}));
  jest.spyOn(service.paymentIntents, "create").mockResolvedValue(stub(stripeData.paymentIntent));
  jest.spyOn(service.prices, "list").mockResolvedValue(stub({ data: [] }));
  jest.spyOn(service.promotionCodes, "list").mockResolvedValue(stub({ data: [] }));
  jest.spyOn(service.coupons, "list").mockResolvedValue(stub({ data: [] }));
  jest.spyOn(service.charges, "list").mockResolvedValue(stub({ data: [], has_more: false }));

  return {
    service,
    userRepository,
    refillService,
    billingConfig,
    paymentMethodRepository
  };
}
