import { createMongoAbility } from "@casl/ability";
import { mock } from "jest-mock-extended";
import type Stripe from "stripe";

import type { PaymentMethodRepository, StripeTransactionRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { UserRepository } from "@src/user/repositories";
import { StripeService } from "./stripe.service";

import { generateDatabasePaymentMethod } from "@test/seeders/database-payment-method.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { create as StripeSeederCreate } from "@test/seeders/stripe.seeder";
import {
  createTestCharge,
  createTestCoupon,
  createTestInvoice,
  createTestPaymentIntent,
  createTestPromotionCode,
  TEST_CONSTANTS
} from "@test/seeders/stripe-test-data.seeder";
import { createTestTransaction } from "@test/seeders/stripe-transaction-test.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";

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
      userId: TEST_CONSTANTS.USER_ID,
      customer: TEST_CONSTANTS.CUSTOMER_ID,
      payment_method: TEST_CONSTANTS.PAYMENT_METHOD_ID,
      amount: 100,
      currency: "usd",
      confirm: true
    };

    it("creates payment intent successfully", async () => {
      const { service, stripeTransactionRepository } = setup();
      const result = await service.createPaymentIntent(mockPaymentParams);
      expect(stripeTransactionRepository.create).toHaveBeenCalledWith({
        userId: mockPaymentParams.userId,
        type: "payment_intent",
        status: "created",
        amount: 10000,
        currency: mockPaymentParams.currency
      });
      expect(service.paymentIntents.create).toHaveBeenCalledWith({
        customer: mockPaymentParams.customer,
        payment_method: mockPaymentParams.payment_method,
        amount: 10000,
        currency: mockPaymentParams.currency,
        confirm: mockPaymentParams.confirm,
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
  });

  describe("getCustomerTransactions", () => {
    it("returns formatted transactions", async () => {
      const { service } = setup();
      const mockCharge = createTestCharge();
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      jest.spyOn(service.charges, "list").mockResolvedValue(mockCharges);

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
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      jest.spyOn(service.charges, "list").mockResolvedValue(mockCharges);

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
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      jest.spyOn(service.charges, "list").mockResolvedValue(mockCharges);

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
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      jest.spyOn(service.charges, "list").mockResolvedValue(mockCharges);

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
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      jest.spyOn(service.charges, "list").mockResolvedValue(mockCharges);

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID);

      expect(result.prevPage).toBeNull();
    });

    it("calls charges.list with all parameters combined", async () => {
      const { service } = setup();
      const mockCharges = {
        data: [],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      jest.spyOn(service.charges, "list").mockResolvedValue(mockCharges);

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

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

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

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

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

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

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

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

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

      const chunks: string[] = [];
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
      const { service, refillService, stripeTransactionRepository } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({
        id: "coupon_123",
        amount_off: 1000,
        percent_off: null,
        valid: true,
        currency: "usd",
        name: "Test Coupon"
      });
      const mockPromotionCode = createTestPromotionCode({
        id: "promo_123",
        promotion: {
          type: "coupon",
          coupon: mockCoupon
        }
      });
      const mockInvoice = createTestInvoice({ id: "in_123", status: "draft" });
      const mockFinalizedInvoice = createTestInvoice({ id: "in_123", status: "paid" });

      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      jest.spyOn(service.invoices, "create").mockResolvedValue(mockInvoice);
      jest.spyOn(service.invoices, "finalizeInvoice").mockResolvedValue(mockFinalizedInvoice);
      refillService.topUpWallet.mockResolvedValue();

      const result = await service.applyCoupon(mockUser, mockPromotionCode.code);

      expect(service.invoices.create).toHaveBeenCalledWith({
        customer: mockUser.stripeCustomerId,
        auto_advance: false,
        discounts: [{ promotion_code: mockPromotionCode.id }]
      });
      expect(service.invoices.finalizeInvoice).toHaveBeenCalledWith(mockInvoice.id);

      // Verify transaction is created with pending status first
      expect(stripeTransactionRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        type: "coupon_claim",
        status: "pending",
        amount: 1000,
        currency: "usd",
        stripeCouponId: mockCoupon.id,
        stripePromotionCodeId: mockPromotionCode.id,
        stripeInvoiceId: mockInvoice.id,
        description: `Coupon: ${mockCoupon.name}`
      });

      // Verify wallet top-up happens after transaction creation
      expect(refillService.topUpWallet).toHaveBeenCalledWith(1000, mockUser.id);

      // Verify transaction is updated to succeeded after wallet top-up
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("test-transaction-id", { status: "succeeded" });

      expect(result).toEqual({
        coupon: mockPromotionCode,
        amountAdded: 10 // 1000 cents = $10
      });
    });

    it("applies coupon successfully when no promotion code found", async () => {
      const { service, refillService, stripeTransactionRepository } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({
        id: "coupon_direct",
        amount_off: 500,
        percent_off: null,
        valid: true,
        currency: "usd",
        name: "Direct Coupon"
      });
      const mockInvoice = createTestInvoice({ id: "in_456", status: "draft" });
      const mockFinalizedInvoice = createTestInvoice({ id: "in_456", status: "paid" });

      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      jest.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });
      jest.spyOn(service.invoices, "create").mockResolvedValue(mockInvoice);
      jest.spyOn(service.invoices, "finalizeInvoice").mockResolvedValue(mockFinalizedInvoice);
      refillService.topUpWallet.mockResolvedValue();

      const result = await service.applyCoupon(mockUser, mockCoupon.id);

      expect(service.invoices.create).toHaveBeenCalledWith({
        customer: mockUser.stripeCustomerId,
        auto_advance: false,
        discounts: [{ coupon: mockCoupon.id }]
      });
      expect(service.invoices.finalizeInvoice).toHaveBeenCalledWith(mockInvoice.id);

      // Verify transaction is created with pending status (no promotion code ID for direct coupon)
      expect(stripeTransactionRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        type: "coupon_claim",
        status: "pending",
        amount: 500,
        currency: "usd",
        stripeCouponId: mockCoupon.id,
        stripePromotionCodeId: undefined,
        stripeInvoiceId: mockInvoice.id,
        description: `Coupon: ${mockCoupon.name}`
      });

      expect(refillService.topUpWallet).toHaveBeenCalledWith(500, mockUser.id);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("test-transaction-id", { status: "succeeded" });

      expect(result).toEqual({
        coupon: mockCoupon,
        amountAdded: 5 // 500 cents = $5
      });
    });

    it("rejects percentage-based promotion codes", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockPromotionCode = createTestPromotionCode({
        promotion: {
          type: "coupon",
          coupon: {
            ...createTestCoupon(),
            percent_off: 20,
            amount_off: null,
            valid: true
          }
        }
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );
    });

    it("rejects promotion codes without amount_off", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockPromotionCode = createTestPromotionCode({
        promotion: {
          type: "coupon",
          coupon: {
            ...createTestCoupon(),
            percent_off: null,
            amount_off: null,
            valid: true
          }
        }
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("rejects percentage-based coupons", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({
        percent_off: 20,
        amount_off: null,
        valid: true
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      jest.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });

      await expect(service.applyCoupon(mockUser, mockCoupon.id)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );
    });

    it("rejects coupons without amount_off", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({
        percent_off: null,
        amount_off: null,
        valid: true
      });
      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      jest.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });

      await expect(service.applyCoupon(mockUser, mockCoupon.id)).rejects.toThrow("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("throws error for invalid promotion code", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      jest.spyOn(service.promotionCodes, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>);
      jest.spyOn(service.coupons, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);

      await expect(service.applyCoupon(mockUser, "INVALID_CODE")).rejects.toThrow("No valid promotion code or coupon found with the provided code");
    });

    it("throws error when topUpWallet fails after invoice is finalized and leaves transaction in pending", async () => {
      const { service, refillService, stripeTransactionRepository } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({
        id: "coupon_123",
        amount_off: 1000,
        percent_off: null,
        valid: true,
        currency: "usd",
        name: "Test Coupon"
      });
      const mockPromotionCode = createTestPromotionCode({
        id: "promo_123",
        promotion: {
          type: "coupon",
          coupon: mockCoupon
        }
      });
      const mockInvoice = createTestInvoice({ id: "in_123", status: "draft" });
      const mockFinalizedInvoice = createTestInvoice({ id: "in_123", status: "paid" });

      jest.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      jest.spyOn(service.invoices, "create").mockResolvedValue(mockInvoice);
      jest.spyOn(service.invoices, "finalizeInvoice").mockResolvedValue(mockFinalizedInvoice);
      refillService.topUpWallet.mockRejectedValue(new Error("Wallet top-up failed"));

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow("Wallet top-up failed");

      // Verify transaction was created with pending status
      expect(stripeTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
          type: "coupon_claim"
        })
      );

      // Verify transaction was NOT updated to succeeded (since topUpWallet failed)
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();

      // Verify that the invoice was created and finalized before the wallet top-up failed
      expect(service.invoices.create).toHaveBeenCalledWith({
        customer: mockUser.stripeCustomerId,
        auto_advance: false,
        discounts: [{ promotion_code: mockPromotionCode.id }]
      });
      expect(service.invoices.finalizeInvoice).toHaveBeenCalledWith(mockInvoice.id);
      expect(refillService.topUpWallet).toHaveBeenCalledWith(1000, mockUser.id);
    });
  });

  describe("createSetupIntent", () => {
    it("creates setup intent with correct parameters", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      jest.spyOn(service.setupIntents, "create").mockResolvedValue(stripeData.setupIntent);

      const result = await service.createSetupIntent(TEST_CONSTANTS.CUSTOMER_ID);
      expect(service.setupIntents.create).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
        usage: "off_session",
        payment_method_types: ["card", "link"]
      });
      expect(result).toEqual(stripeData.setupIntent);
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
      jest.spyOn(service.prices, "list").mockResolvedValue({ data: mockPrices } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Price>>);

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
            phone: "1-233-340-5835 x45200",
            tax_id: null
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
            phone: "336.613.4413 x6559",
            tax_id: null
          }
        })
      ];
      jest
        .spyOn(service.paymentMethods, "list")
        .mockResolvedValue({ data: mockPaymentMethods } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
      paymentMethodRepository.findByUserId.mockResolvedValue([]);

      const result = await service.getPaymentMethods(
        TEST_CONSTANTS.USER_ID,
        TEST_CONSTANTS.CUSTOMER_ID,
        createMongoAbility([{ action: "read", subject: "PaymentMethod" }])
      );
      expect(service.paymentMethods.list).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID
      });
      // The method sorts by created timestamp in descending order, so pm_123 (higher timestamp) comes first
      expect(result).toEqual([
        {
          ...mockPaymentMethods[0],
          validated: false,
          isDefault: false
        },
        {
          ...mockPaymentMethods[1],
          validated: false,
          isDefault: false
        }
      ]);
    });
  });

  describe("listPromotionCodes", () => {
    it("returns promotion codes with expanded coupons", async () => {
      const { service } = setup();
      const stripeData = StripeSeederCreate();
      const mockPromotionCodes = [stripeData.promotionCode, { id: "promo_456", code: "TEST100", coupon: { id: "coupon_456" } }];
      jest
        .spyOn(service.promotionCodes, "list")
        .mockResolvedValue({ data: mockPromotionCodes } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>);

      const result = await service.listPromotionCodes();
      expect(service.promotionCodes.list).toHaveBeenCalledWith({
        expand: ["data.promotion.coupon"]
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
      jest.spyOn(service.coupons, "list").mockResolvedValue({ data: mockCoupons } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);

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
      jest.spyOn(service.coupons, "retrieve").mockResolvedValue(mockCoupon as unknown as Stripe.Response<Stripe.Coupon>);

      const result = await service.getCoupon(TEST_CONSTANTS.COUPON_ID);
      expect(service.coupons.retrieve).toHaveBeenCalledWith(TEST_CONSTANTS.COUPON_ID);
      expect(result).toEqual(mockCoupon);
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

    it("should resolve with false provided empty payment methods array", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = TEST_CONSTANTS.USER_ID;
      const paymentMethods: Stripe.PaymentMethod[] = [];

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOthersTrialingByFingerprint).not.toHaveBeenCalled();
    });

    it("should resolve with false provided payment methods without fingerprints", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = TEST_CONSTANTS.USER_ID;
      const paymentMethods: Stripe.PaymentMethod[] = [{ card: { fingerprint: null } } as Stripe.PaymentMethod];

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOthersTrialingByFingerprint).not.toHaveBeenCalled();
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
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent);
      paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);

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
      const mockPaymentIntent = createTestPaymentIntent({
        id: "pi_test_123",
        status: "requires_action",
        client_secret: "pi_test_123_secret_abc123"
      });

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
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

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
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);

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
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      const result = await service.createTestCharge(mockParams);

      expect(result).toEqual({
        success: false,
        paymentIntentId: mockPaymentIntent.id
      });
    });

    it("handles user not found scenario", async () => {
      const mockPaymentIntent = createTestPaymentIntent({
        id: "pi_test_123",
        status: "succeeded",
        amount: 100
      });

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
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

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
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);

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
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent creation - only one call needed since we reuse the existing intent
      jest.spyOn(service.paymentIntents, "create").mockResolvedValueOnce(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

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
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Override default payment intent mock
      jest.spyOn(service.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

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
        status: "succeeded",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);

      const result = await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(result).toEqual({ success: true });
      expect(service.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(mockParams.paymentMethodId, mockUser.id);
    });

    it("marks payment method as validated when payment intent requires_capture", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockUser = UserSeeder.create({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPaymentIntent = {
        id: "pi_123",
        status: "requires_capture",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);

      const result = await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(result).toEqual({ success: true });
      expect(service.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(mockParams.paymentMethodId, mockUser.id);
    });

    it("logs warning when payment intent is not successful", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockPaymentIntent = {
        id: "pi_123",
        status: "requires_payment_method",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      const result = await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(result).toEqual({ success: false });
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
        status: "succeeded",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      const result = await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(result).toEqual({ success: true });
      expect(service.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).not.toHaveBeenCalled();
    });

    it("throws error when payment intent belongs to different customer", async () => {
      const { service } = setup();
      const mockPaymentIntent = {
        id: "pi_123",
        status: "succeeded",
        customer: "cus_different",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      await expect(service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId)).rejects.toThrow(
        "Payment intent does not belong to the user"
      );
    });

    it("throws error when payment intent references different payment method", async () => {
      const { service } = setup();
      const mockPaymentIntent = {
        id: "pi_123",
        status: "succeeded",
        customer: "cus_123",
        payment_method: "pm_different",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      await expect(service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId)).rejects.toThrow(
        "Payment intent does not reference the provided payment method"
      );
    });
  });
});

function setup(
  params: {
    user?: ReturnType<typeof createTestUser> | null;
    paymentIntent?: Stripe.Response<Stripe.PaymentIntent>;
    paymentMethodValidation?: any[];
  } = {}
) {
  const billingConfig = mock<BillingConfigService>({ get: jest.fn().mockReturnValue("sk_live_key") });
  const userRepository = mock<UserRepository>();
  const refillService = mock<RefillService>();
  const paymentMethodRepository = mock<PaymentMethodRepository>();
  const stripeTransactionRepository = mock<StripeTransactionRepository>();

  const service = new StripeService(billingConfig, userRepository, refillService, paymentMethodRepository, stripeTransactionRepository, mock<LoggerService>());

  // Setup stripe transaction repository mocks
  stripeTransactionRepository.create.mockImplementation(async input => ({
    id: "test-transaction-id",
    userId: input.userId,
    type: input.type,
    status: input.status ?? "created",
    amount: input.amount,
    amountRefunded: input.amountRefunded ?? 0,
    currency: input.currency ?? "usd",
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeChargeId: input.stripeChargeId ?? null,
    stripeCouponId: input.stripeCouponId ?? null,
    stripePromotionCodeId: input.stripePromotionCodeId ?? null,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
    paymentMethodType: input.paymentMethodType ?? null,
    cardBrand: input.cardBrand ?? null,
    cardLast4: input.cardLast4 ?? null,
    receiptUrl: input.receiptUrl ?? null,
    description: input.description ?? null,
    errorMessage: input.errorMessage ?? null,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  stripeTransactionRepository.updateById.mockResolvedValue(undefined);
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
  paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);
  paymentMethodRepository.findOthersTrialingByFingerprint.mockResolvedValue(undefined);
  paymentMethodRepository.accessibleBy.mockReturnValue(paymentMethodRepository);

  // Setup user repository mock based on parameters
  const userToReturn = "user" in params ? params.user : createTestUser();
  jest.spyOn(userRepository, "findOneBy").mockResolvedValue(userToReturn ?? undefined);

  // Mock Stripe methods
  jest.spyOn(service.customers, "create").mockResolvedValue(stripeData.customer);
  jest.spyOn(service.customers, "update").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Customer>);
  jest.spyOn(service.customers, "retrieve").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Customer>);
  // Setup payment intent mock based on parameters
  const paymentIntentToReturn = params.paymentIntent || stripeData.paymentIntent;
  jest.spyOn(service.paymentIntents, "create").mockResolvedValue(paymentIntentToReturn);
  jest.spyOn(service.paymentIntents, "retrieve").mockResolvedValue(stripeData.paymentIntent);
  jest.spyOn(service.prices, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Price>>);
  jest.spyOn(service.promotionCodes, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>);
  jest.spyOn(service.coupons, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);
  jest.spyOn(service.coupons, "retrieve").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Coupon>);
  jest.spyOn(service.charges, "list").mockResolvedValue({ data: [], has_more: false } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>);
  jest.spyOn(service.refunds, "create").mockResolvedValue({} as unknown as Stripe.Response<Stripe.Refund>);
  jest.spyOn(service.refunds, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Refund>>);
  jest.spyOn(service.setupIntents, "create").mockResolvedValue(stripeData.setupIntent);
  jest.spyOn(service.paymentMethods, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
  jest.spyOn(service.invoices, "create").mockResolvedValue(createTestInvoice());
  jest.spyOn(service.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ status: "paid" }));

  return {
    service,
    userRepository,
    refillService,
    billingConfig,
    paymentMethodRepository,
    stripeTransactionRepository
  };
}
