import { mock } from "jest-mock-extended";
import type Stripe from "stripe";

import type { PaymentMethodRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { UserRepository } from "@src/user/repositories";
import { StripeService } from "./stripe.service";

import { generateDatabasePaymentMethod } from "@test/seeders/database-payment-method.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { create as StripeSeederCreate } from "@test/seeders/stripe.seeder";
import { createTestCharge, createTestCoupon, createTestPaymentIntent, createTestPromotionCode, TEST_CONSTANTS } from "@test/seeders/stripe-test-data.seeder";
import { createTestTransaction } from "@test/seeders/stripe-transaction-test.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";
import { stub } from "@test/services/stub";

describe(StripeService.name, () => {
  describe("getStripeCustomerId", () => {
    it("returns existing user when stripeCustomerId exists", async () => {
      const { service } = setup();
      const userWithStripeId = createTestUser();
      const result = await service.getStripeCustomerId(userWithStripeId);
      expect(result).toEqual(userWithStripeId.stripeCustomerId);
      expect(service.customers.create).not.toHaveBeenCalled();
    });

    it("creates new Stripe customer and updates user when no stripeCustomerId", async () => {
      const { service, userRepository } = setup();
      const user = createTestUser({ stripeCustomerId: null });
      const result = await service.getStripeCustomerId(user);
      expect(service.customers.create).toHaveBeenCalledWith({
        email: user.email,
        name: user.username,
        metadata: { userId: user.id }
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
      customer: TEST_CONSTANTS.CUSTOMER_ID,
      payment_method: TEST_CONSTANTS.PAYMENT_METHOD_ID,
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
      const user = createTestUser({ id: "test-user-id-001" });

      // Set lastUser in the mock context so findOneBy returns this user
      jest.spyOn(userRepository, "findOneBy").mockResolvedValue(user);
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
      const mockCharge = createTestCharge();
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID);
      expect(result).toEqual({
        transactions: [
          {
            id: mockCharge.id,
            amount: mockCharge.amount,
            currency: mockCharge.currency,
            status: mockCharge.status,
            created: mockCharge.created,
            paymentMethod: mockCharge.payment_method_details,
            receiptUrl: mockCharge.receipt_url,
            description: mockCharge.description,
            metadata: mockCharge.metadata
          }
        ],
        hasMore: false,
        nextPage: mockCharge.id,
        prevPage: null
      });
    });

    it("calls charges.list with endingBefore parameter", async () => {
      const { service } = setup();
      const mockCharge = createTestCharge({ id: "ch_456", amount: 2000 });
      const mockCharges = {
        data: [mockCharge],
        has_more: true
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID, {
        endingBefore: "ch_before_id",
        limit: 50
      });

      expect(service.charges.list).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
        limit: 50,
        created: undefined,
        starting_after: undefined,
        ending_before: "ch_before_id",
        expand: ["data.payment_intent"]
      });
    });

    it("calls charges.list with created parameter", async () => {
      const { service } = setup();
      const mockCharge = createTestCharge({ id: "ch_789", amount: 3000 });
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      const startDate = new Date("2022-01-01T00:00:00Z").toISOString();
      const endDate = new Date("2022-12-31T23:59:59Z").toISOString();
      await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID, {
        startDate,
        endDate,
        limit: 25
      });

      expect(service.charges.list).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
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
      const firstCharge = createTestCharge({
        id: "ch_first",
        amount: 1000,
        description: "First charge"
      });
      const secondCharge = createTestCharge({
        id: "ch_second",
        amount: 2000,
        created: 1234567891,
        description: "Second charge"
      });
      const mockCharges = {
        data: [firstCharge, secondCharge],
        has_more: true
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID, {
        startingAfter: "ch_previous_id"
      });

      expect(result).toEqual({
        transactions: [
          {
            id: firstCharge.id,
            amount: firstCharge.amount,
            currency: firstCharge.currency,
            status: firstCharge.status,
            created: firstCharge.created,
            paymentMethod: firstCharge.payment_method_details,
            receiptUrl: firstCharge.receipt_url,
            description: firstCharge.description,
            metadata: firstCharge.metadata
          },
          {
            id: secondCharge.id,
            amount: secondCharge.amount,
            currency: secondCharge.currency,
            status: secondCharge.status,
            created: secondCharge.created,
            paymentMethod: secondCharge.payment_method_details,
            receiptUrl: secondCharge.receipt_url,
            description: secondCharge.description,
            metadata: secondCharge.metadata
          }
        ],
        hasMore: true,
        nextPage: secondCharge.id,
        prevPage: firstCharge.id
      });
    });

    it("returns null prevPage when startingAfter is not provided", async () => {
      const { service } = setup();
      const mockCharge = createTestCharge({
        id: "ch_only",
        description: "Only charge"
      });
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      };

      jest.spyOn(service.charges, "list").mockResolvedValue(stub(mockCharges));

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID);

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

      await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID, options);

      expect(service.charges.list).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
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
      const mockTransaction = createTestTransaction();

      jest.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks = await Array.fromAsync(csvStream);

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain("Transaction ID,Date (America/New_York),Amount,Currency,Status,Payment Method,Card Brand,Card Last 4,Description,Receipt URL");

      expect(fullCsv).toContain(mockTransaction.id);
      expect(fullCsv).toContain("2021-12-31, 7:00:00 p.m.");
      expect(fullCsv).toContain("10.00");
      expect(fullCsv).toContain("visa");
      expect(fullCsv).toContain("4242");
    });

    it("streams multiple pages without loading all into memory", async () => {
      const { service } = setup();

      const firstPageTransaction = createTestTransaction({
        id: "ch_001",
        amount: 1000,
        description: "First transaction",
        paymentMethod: generatePaymentMethod({
          type: "card",
          card: {
            brand: "visa",
            last4: "1111"
          }
        })
      });

      const secondPageTransaction = createTestTransaction({
        id: "ch_002",
        amount: 2000,
        created: 1641081600,
        description: "Second transaction",
        paymentMethod: generatePaymentMethod({
          type: "card",
          card: {
            brand: "mastercard",
            last4: "2222"
          }
        })
      });

      jest
        .spyOn(service, "getCustomerTransactions")
        .mockResolvedValueOnce({
          transactions: [firstPageTransaction],
          hasMore: true,
          nextPage: "ch_001",
          prevPage: null
        })
        .mockResolvedValueOnce({
          transactions: [secondPageTransaction],
          hasMore: false,
          nextPage: null,
          prevPage: "ch_002"
        });

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks = await Array.fromAsync(csvStream);

      const fullCsv = chunks.join("");

      expect(service.getCustomerTransactions).toHaveBeenCalledTimes(2);
      expect(service.getCustomerTransactions).toHaveBeenNthCalledWith(1, TEST_CONSTANTS.CUSTOMER_ID, {
        limit: 100,
        startingAfter: undefined,
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z"
      });
      expect(service.getCustomerTransactions).toHaveBeenNthCalledWith(2, TEST_CONSTANTS.CUSTOMER_ID, {
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

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
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
      const mockTransaction = createTestTransaction({
        id: "ch_123",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        created: 1640995200,
        paymentMethod: null,
        receiptUrl: null,
        description: "No payment method"
      });

      jest.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
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

    it("handles error during streaming gracefully", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction();

      jest
        .spyOn(service, "getCustomerTransactions")
        .mockResolvedValueOnce({
          transactions: [mockTransaction],
          hasMore: true,
          nextPage: "ch_123",
          prevPage: null
        })
        .mockRejectedValueOnce(new Error("Stripe API error"));

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain("Transaction ID,Date (America/New_York),Amount,Currency,Status,Payment Method,Card Brand,Card Last 4,Description,Receipt URL");
      expect(fullCsv).toContain("ch_123");
      expect(fullCsv).toContain("Error: Stripe API error");
    });
  });

  describe("applyCoupon", () => {
    it("applies promotion code successfully and tops up wallet", async () => {
      const { service, refillService } = setup();
      const mockUser = createTestUser();
      const mockPromotionCode = createTestPromotionCode({
        coupon: {
          ...createTestCoupon(),
          amount_off: 1000,
          percent_off: null as any,
          valid: true
        }
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(stub(mockPromotionCode));
      refillService.topUpWallet.mockResolvedValue();

      const result = await service.applyCoupon(mockUser, mockPromotionCode.code);

      expect(refillService.topUpWallet).toHaveBeenCalledWith(1000, mockUser.id);
      expect(service.customers.update).toHaveBeenCalledTimes(2);
      expect(service.customers.update).toHaveBeenNthCalledWith(1, TEST_CONSTANTS.CUSTOMER_ID, {
        promotion_code: mockPromotionCode.id
      });
      expect(service.customers.update).toHaveBeenNthCalledWith(2, TEST_CONSTANTS.CUSTOMER_ID, {
        promotion_code: null
      });
      expect(result).toEqual({
        coupon: mockPromotionCode,
        amountAdded: 10 // 1000 cents = $10
      });
    });

    it("rejects percentage-based promotion codes", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockPromotionCode = createTestPromotionCode({
        coupon: {
          ...createTestCoupon(),
          percent_off: 20,
          amount_off: null as any,
          valid: true
        }
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode as any);

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );
    });

    it("rejects promotion codes without amount_off", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockPromotionCode = createTestPromotionCode({
        coupon: {
          ...createTestCoupon(),
          percent_off: null as any,
          amount_off: null as any,
          valid: true
        }
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode as any);

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("rejects percentage-based coupons", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({
        percent_off: 20,
        amount_off: null as any,
        valid: true
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(null as any);
      jest.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] } as any);

      await expect(service.applyCoupon(mockUser, mockCoupon.id)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );
    });

    it("rejects coupons without amount_off", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({
        percent_off: null as any,
        amount_off: null as any,
        valid: true
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(null as any);
      jest.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] } as any);

      await expect(service.applyCoupon(mockUser, mockCoupon.id)).rejects.toThrow("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("throws error for invalid promotion code", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      jest.spyOn(service.promotionCodes, "list").mockResolvedValue(stub({ data: [] }));
      jest.spyOn(service.coupons, "list").mockResolvedValue(stub({ data: [] }));

      await expect(service.applyCoupon(mockUser, "INVALID_CODE")).rejects.toThrow("No valid promotion code or coupon found with the provided code");
    });

    it("rolls back coupon application when topUpWallet fails", async () => {
      const { service, refillService } = setup();
      const mockUser = createTestUser();
      const mockPromotionCode = createTestPromotionCode({
        coupon: {
          ...createTestCoupon(),
          amount_off: 1000,
          percent_off: null as number | null,
          valid: true
        }
      });

      jest.spyOn(service.promotionCodes, "list").mockResolvedValue({ data: [mockPromotionCode] } as any);
      jest.spyOn(service.customers, "update").mockResolvedValue({} as any);

      // Mock topUpWallet to fail
      refillService.topUpWallet.mockRejectedValue(new Error("Wallet top-up failed"));

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow("Wallet top-up failed");

      // Verify that the coupon was applied and then rolled back
      expect(service.customers.update).toHaveBeenCalledTimes(2);
      expect(service.customers.update).toHaveBeenNthCalledWith(1, TEST_CONSTANTS.CUSTOMER_ID, {
        promotion_code: mockPromotionCode.id
      });
      expect(service.customers.update).toHaveBeenNthCalledWith(2, TEST_CONSTANTS.CUSTOMER_ID, {
        promotion_code: null
      });
    });
  });

  describe("createSetupIntent", () => {
    it("creates setup intent with correct parameters", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      jest.spyOn(service.setupIntents, "create").mockResolvedValue(stub(stripeData.setupIntent));

      const result = await service.createSetupIntent(TEST_CONSTANTS.CUSTOMER_ID);
      expect(service.setupIntents.create).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
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
        customerId: TEST_CONSTANTS.CUSTOMER_ID,
        redirectUrl: "https://return.url",
        amount: "20"
      });

      expect(service.checkout.sessions.create).toHaveBeenCalledWith({
        line_items: [{ price: "price_123", quantity: 1 }],
        mode: "payment",
        allow_promotion_codes: true,
        customer: TEST_CONSTANTS.CUSTOMER_ID,
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
        customerId: TEST_CONSTANTS.CUSTOMER_ID,
        redirectUrl: "https://return.url"
      });

      expect(service.checkout.sessions.create).toHaveBeenCalledWith({
        line_items: [{ price: "price_123", quantity: 1 }],
        mode: "payment",
        allow_promotion_codes: false,
        customer: TEST_CONSTANTS.CUSTOMER_ID,
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
          customerId: TEST_CONSTANTS.CUSTOMER_ID,
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
      const { service, paymentMethodRepository } = setup();
      const mockPaymentMethods = [
        generatePaymentMethod({
          id: TEST_CONSTANTS.PAYMENT_METHOD_ID,
          created: 1757992768,
          card: {
            brand: "visa",
            last4: "8732",
            exp_month: 8,
            exp_year: 2027,
            fingerprint: "6a91270a-2f4a-481a-9b03-40b62efb6aff"
          },
          billing_details: {
            address: {
              city: "Pembroke Pines",
              country: "US",
              line1: "81275 Cambridge Street",
              line2: null,
              postal_code: "04285-3982",
              state: "New Hampshire"
            },
            email: "Claudie27@yahoo.com",
            name: "Winifred Wiegand",
            phone: "1-233-340-5835 x45200"
          }
        }),
        generatePaymentMethod({
          id: "pm_456",
          created: 1757991776,
          card: {
            brand: "mastercard",
            last4: "0777",
            exp_month: 4,
            exp_year: 2030,
            fingerprint: "a7c2eb4c-e81e-48cd-9515-71089d4bd0ce"
          },
          billing_details: {
            address: {
              city: "West Estellaburgh",
              country: "US",
              line1: "842 Molly Circles",
              line2: null,
              postal_code: "51261-2993",
              state: "North Carolina"
            },
            email: "Golda_Rodriguez95@yahoo.com",
            name: "Robin Nader V",
            phone: "336.613.4413 x6559"
          }
        })
      ];
      jest.spyOn(service.paymentMethods, "list").mockResolvedValue(stub({ data: mockPaymentMethods }));
      paymentMethodRepository.findByUserId.mockResolvedValue([]);

      const result = await service.getPaymentMethods(TEST_CONSTANTS.USER_ID, TEST_CONSTANTS.CUSTOMER_ID);
      expect(service.paymentMethods.list).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID
      });
      // The method sorts by created timestamp in descending order, so pm_123 (higher timestamp) comes first
      expect(result).toEqual([
        {
          ...mockPaymentMethods[0],
          validated: false
        },
        {
          ...mockPaymentMethods[1],
          validated: false
        }
      ]);
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
        { id: TEST_CONSTANTS.COUPON_ID, percent_off: 50 },
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
      const mockCoupon = { id: TEST_CONSTANTS.COUPON_ID, percent_off: 50 };
      jest.spyOn(service.coupons, "retrieve").mockResolvedValue(stub(mockCoupon));

      const result = await service.getCoupon(TEST_CONSTANTS.COUPON_ID);
      expect(service.coupons.retrieve).toHaveBeenCalledWith(TEST_CONSTANTS.COUPON_ID);
      expect(result).toEqual(mockCoupon);
    });
  });

  describe("consumeActiveDiscount", () => {
    it("should consume active discount", async () => {
      const { service } = setup();
      const customerId = TEST_CONSTANTS.CUSTOMER_ID;
      jest.spyOn(service, "getCustomerDiscounts").mockResolvedValue([
        {
          type: "promotion_code",
          id: TEST_CONSTANTS.PROMOTION_CODE_ID,
          coupon_id: TEST_CONSTANTS.COUPON_ID,
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
      const customerId = TEST_CONSTANTS.CUSTOMER_ID;
      jest.spyOn(service, "getCustomerDiscounts").mockResolvedValue([]);
      const result = await service.consumeActiveDiscount(customerId);
      expect(result).toBe(false);
      expect(service.customers.update).not.toHaveBeenCalled();
    });
  });

  describe("hasDuplicateTrialAccount", () => {
    it("should return true when duplicate payment method fingerprints in trialing wallets are found", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = TEST_CONSTANTS.USER_ID;
      const paymentMethods = [
        generatePaymentMethod({
          id: "pm_1",
          card: { fingerprint: "fp_123" }
        }),
        generatePaymentMethod({
          id: "pm_2",
          card: { fingerprint: "fp_456" }
        })
      ];

      paymentMethodRepository.findOthersTrialingByFingerprint.mockResolvedValue([
        generateDatabasePaymentMethod({
          id: "existing_pm",
          userId: "other_user",
          fingerprint: "fp_123",
          paymentMethodId: "pm_1",
          isValidated: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      ]);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(true);
      expect(paymentMethodRepository.findOthersTrialingByFingerprint).toHaveBeenCalledWith(["fp_123", "fp_456"], currentUserId);
    });

    it("should return false when no duplicate payment method fingerprints in trialing wallets are found", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = TEST_CONSTANTS.USER_ID;
      const paymentMethods = [
        generatePaymentMethod({
          id: "pm_1",
          card: { fingerprint: "fp_123" }
        })
      ];

      paymentMethodRepository.findOthersTrialingByFingerprint.mockResolvedValue(undefined);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOthersTrialingByFingerprint).toHaveBeenCalledWith(["fp_123"], currentUserId);
    });

    it("should filter out payment methods without fingerprints in trialing wallets", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = TEST_CONSTANTS.USER_ID;
      const paymentMethods = [
        generatePaymentMethod({
          id: "pm_1",
          card: { fingerprint: "fp_123" }
        }),
        generatePaymentMethod({
          id: "pm_2",
          card: null
        }),
        generatePaymentMethod({
          id: "pm_3",
          card: { fingerprint: undefined }
        })
      ];

      paymentMethodRepository.findOthersTrialingByFingerprint.mockResolvedValue(undefined);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      // Extract only the fingerprints that are not null/undefined from the actual payment methods
      const expectedFingerprints = paymentMethods.map(pm => pm.card?.fingerprint).filter(Boolean) as string[];
      expect(paymentMethodRepository.findOthersTrialingByFingerprint).toHaveBeenCalledWith(expectedFingerprints, currentUserId);
    });

    it("should handle empty payment methods array in trialing wallets", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = TEST_CONSTANTS.USER_ID;
      const paymentMethods: Stripe.PaymentMethod[] = [];

      paymentMethodRepository.findOthersTrialingByFingerprint.mockResolvedValue(undefined);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOthersTrialingByFingerprint).toHaveBeenCalledWith([], currentUserId);
    });
  });

  describe("createTestCharge", () => {
    const mockParams = {
      customer: TEST_CONSTANTS.CUSTOMER_ID,
      payment_method: TEST_CONSTANTS.PAYMENT_METHOD_ID
    };

    it("creates $0 authorization successfully for card validation in trialing wallets", async () => {
      const { service, paymentMethodRepository, userRepository } = setup();
      const mockUser = createTestUser();
      const mockPaymentIntent = createTestPaymentIntent({ status: "succeeded", amount: 0 });

      jest.spyOn(userRepository, "findOneBy").mockResolvedValue(mockUser);
      paymentMethodRepository.findValidatedByUserId.mockResolvedValue([]);
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as any);
      paymentMethodRepository.markAsValidated.mockResolvedValue({} as any);

      const result = await service.createTestCharge(mockParams);

      expect(service.paymentIntents.create).toHaveBeenCalledWith(
        {
          customer: mockParams.customer,
          payment_method: mockParams.payment_method,
          amount: 100,
          currency: "usd",
          capture_method: "manual",
          confirm: true,
          metadata: {
            type: "payment_method_validation",
            description: "Payment method validation charge"
          },
          payment_method_types: ["card", "link"]
        },
        {
          idempotencyKey: expect.stringMatching(/^card_validation_cus_123_pm_123$/)
        }
      );

      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(mockParams.payment_method, mockUser.id);

      expect(result).toEqual({
        success: true,
        paymentIntentId: mockPaymentIntent.id
      });
    });

    it("handles 3D Secure authentication requirement in trialing wallets", async () => {
      const mockUser = UserSeeder.create({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "requires_action",
        client_secret: "pi_test_123_secret_abc123"
      } as Stripe.PaymentIntent;

      const { service } = setup({
        user: mockUser,
        paymentIntent: mockPaymentIntent
      });

      const result = await service.createTestCharge(mockParams);

      expect(result).toEqual({
        success: false,
        paymentIntentId: mockPaymentIntent.id,
        requiresAction: true,
        clientSecret: mockPaymentIntent.client_secret
      });
    });

    it("handles card decline", async () => {
      const { service } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "requires_payment_method",
        last_payment_error: {
          message: "Your card was declined."
        }
      } as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as any);

      const result = await service.createTestCharge(mockParams);

      expect(result).toEqual({
        success: false,
        paymentIntentId: mockPaymentIntent.id
      });
    });

    it("handles payment intent with requires_capture status", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockUser = UserSeeder.create({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "requires_capture",
        amount: 100
      } as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as any);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue({} as any);

      const result = await service.createTestCharge(mockParams);

      expect(result).toEqual({
        success: true,
        paymentIntentId: mockPaymentIntent.id
      });
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(mockParams.payment_method, mockUser.id);
    });

    it("handles payment intent with unexpected status", async () => {
      const { service } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "processing",
        amount: 100
      } as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as any);

      const result = await service.createTestCharge(mockParams);

      expect(result).toEqual({
        success: false,
        paymentIntentId: mockPaymentIntent.id
      });
    });

    it("handles user not found scenario", async () => {
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "succeeded",
        amount: 100
      } as Stripe.PaymentIntent;

      const { service, paymentMethodRepository } = setup({
        user: null,
        paymentIntent: mockPaymentIntent
      });

      const result = await service.createTestCharge(mockParams);

      expect(result).toEqual({
        success: true,
        paymentIntentId: mockPaymentIntent.id
      });
      // Should not call markAsValidated when user is not found
      expect(paymentMethodRepository.markAsValidated).not.toHaveBeenCalled();
    });

    it("handles payment method validation update failure gracefully", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "succeeded",
        amount: 100
      } as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as any);

      // Mock payment method validation to fail
      paymentMethodRepository.markAsValidated.mockRejectedValue(new Error("Database error"));

      // Should not throw error even if validation update fails
      const result = await service.createTestCharge(mockParams);

      expect(result).toEqual({
        success: true,
        paymentIntentId: mockPaymentIntent.id
      });
    });

    it("handles payment intent creation failure", async () => {
      const { service } = setup();
      const creationError = new Error("Payment failed");

      jest.spyOn(service.paymentIntents, "create").mockRejectedValue(creationError);

      await expect(service.createTestCharge(mockParams)).rejects.toThrow("Payment failed");
    });
  });

  describe("validatePaymentMethodForTrial", () => {
    const mockParams = {
      customer: "cus_123",
      payment_method: "pm_123",
      userId: "user_123"
    };

    it("returns success when no 3DS required", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "succeeded",
        amount: 100
      } as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as any);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue({} as any);

      const result = await service.validatePaymentMethodForTrial(mockParams);

      expect(result).toEqual({
        success: true
      });
    });

    it("reuses existing payment intent when requiresAction is true", async () => {
      const { service } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "requires_action",
        client_secret: "pi_test_123_secret"
      } as Stripe.PaymentIntent;

      // Mock payment intent creation - only one call needed since we reuse the existing intent
      jest.spyOn(service.paymentIntents, "create").mockResolvedValueOnce(mockPaymentIntent as any);

      const result = await service.validatePaymentMethodForTrial(mockParams);

      expect(result).toEqual({
        success: false,
        requires3DS: true,
        clientSecret: mockPaymentIntent.client_secret,
        paymentIntentId: mockPaymentIntent.id,
        paymentMethodId: mockParams.payment_method
      });

      // Verify only one payment intent was created (no duplicate)
      expect(service.paymentIntents.create).toHaveBeenCalledTimes(1);
    });

    it("throws error when validation fails", async () => {
      const { service } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "requires_payment_method",
        amount: 100
      } as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as any);

      await expect(service.validatePaymentMethodForTrial(mockParams)).rejects.toThrow(
        "Card validation failed. Please ensure your payment method is valid and try again."
      );
    });

    it("handles payment intent creation failure", async () => {
      const { service } = setup();

      // Mock payment intent creation to fail
      jest.spyOn(service.paymentIntents, "create").mockRejectedValueOnce(new Error("Payment intent creation failed"));

      await expect(service.validatePaymentMethodForTrial(mockParams)).rejects.toThrow("Payment intent creation failed");
    });
  });

  describe("validatePaymentMethodAfter3DS", () => {
    const mockParams = {
      customerId: "cus_123",
      paymentMethodId: "pm_123",
      paymentIntentId: "pi_123"
    };

    it("marks payment method as validated when payment intent succeeded", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockUser = UserSeeder.create({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPaymentIntent = {
        id: "pi_123",
        status: "succeeded"
      } as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as any);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue({} as any);

      await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(service.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(mockParams.paymentMethodId, mockUser.id);
    });

    it("marks payment method as validated when payment intent requires_capture", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockUser = UserSeeder.create({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPaymentIntent = {
        id: "pi_123",
        status: "requires_capture"
      } as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as any);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue({} as any);

      await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(service.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(mockParams.paymentMethodId, mockUser.id);
    });

    it("logs warning when payment intent is not successful", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockPaymentIntent = {
        id: "pi_123",
        status: "requires_payment_method"
      } as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as any);

      await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(service.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).not.toHaveBeenCalled();
    });

    it("handles payment intent retrieval failure", async () => {
      const { service } = setup();
      const retrievalError = new Error("Payment intent not found");

      // Mock payment intent retrieval to fail
      jest.spyOn(service.paymentIntents, "retrieve").mockRejectedValue(retrievalError);

      await expect(service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId)).rejects.toThrow(
        "Payment intent not found"
      );
    });

    it("handles user not found during validation", async () => {
      const { service, paymentMethodRepository } = setup({ user: undefined });
      const mockPaymentIntent = {
        id: "pi_123",
        status: "succeeded"
      } as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as any);

      await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(service.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).not.toHaveBeenCalled();
    });
  });
});

function setup(
  params: {
    user?: ReturnType<typeof createTestUser> | null;
    paymentIntent?: Stripe.PaymentIntent;
    paymentMethodValidation?: any[];
  } = {}
) {
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

  // Common repository mocks
  paymentMethodRepository.findByUserId.mockResolvedValue([]);
  // Setup payment method validation mock based on parameters
  const validationToReturn = params.paymentMethodValidation || [];
  paymentMethodRepository.findValidatedByUserId.mockResolvedValue(validationToReturn);
  paymentMethodRepository.markAsValidated.mockResolvedValue({} as any);
  paymentMethodRepository.findOthersTrialingByFingerprint.mockResolvedValue(undefined);

  // Setup user repository mock based on parameters
  const userToReturn = "user" in params ? params.user : createTestUser();
  jest.spyOn(userRepository, "findOneBy").mockResolvedValue(userToReturn as any);

  // Mock Stripe methods
  jest.spyOn(service.customers, "create").mockResolvedValue(stub(stripeData.customer));
  jest.spyOn(service.customers, "update").mockResolvedValue(stub({}));
  jest.spyOn(service.customers, "retrieve").mockResolvedValue(stub({}));
  // Setup payment intent mock based on parameters
  const paymentIntentToReturn = params.paymentIntent || stripeData.paymentIntent;
  jest.spyOn(service.paymentIntents, "create").mockResolvedValue(stub(paymentIntentToReturn));
  jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(stub(stripeData.paymentIntent));
  jest.spyOn(service.prices, "list").mockResolvedValue(stub({ data: [] }));
  jest.spyOn(service.promotionCodes, "list").mockResolvedValue(stub({ data: [] }));
  jest.spyOn(service.coupons, "list").mockResolvedValue(stub({ data: [] }));
  jest.spyOn(service.coupons, "retrieve").mockResolvedValue(stub({}));
  jest.spyOn(service.charges, "list").mockResolvedValue(stub({ data: [], has_more: false }));
  jest.spyOn(service.refunds, "create").mockResolvedValue(stub({}));
  jest.spyOn(service.refunds, "list").mockResolvedValue(stub({ data: [] }));
  jest.spyOn(service.setupIntents, "create").mockResolvedValue(stub(stripeData.setupIntent));
  jest.spyOn(service.checkout.sessions, "create").mockResolvedValue(stub(stripeData.checkoutSession));
  jest.spyOn(service.paymentMethods, "list").mockResolvedValue(stub({ data: [] }));

  return {
    service,
    userRepository,
    refillService,
    billingConfig,
    paymentMethodRepository
  };
}
