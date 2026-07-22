import type { LoggerService } from "@akashnetwork/logging";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import crypto from "crypto";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentMethodRepository, StripeTransactionRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { UserRepository } from "@src/user/repositories";
import { StripeService } from "./stripe.service";

import { generateDatabasePaymentMethod } from "@test/seeders/database-payment-method.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { create as StripeSeederCreate } from "@test/seeders/stripe.seeder";
import { createTestCoupon, createTestInvoice, createTestPaymentIntent, createTestPromotionCode, TEST_CONSTANTS } from "@test/seeders/stripe-test-data.seeder";
import { createUser } from "@test/seeders/user.seeder";
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

  describe("applyCoupon", () => {
    it("applies promotion code successfully, creates invoice with item, and leaves transaction pending for webhook", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
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

      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(mockFinalizedInvoice);

      const result = await service.applyCoupon(mockUser, mockPromotionCode.code);

      expect(stripe.invoices.create).toHaveBeenCalledWith({
        customer: mockUser.stripeCustomerId,
        auto_advance: false,
        discounts: [{ promotion_code: mockPromotionCode.id }]
      });
      expect(stripe.invoiceItems.create).toHaveBeenCalledWith({
        amount: 1000,
        customer: mockUser.stripeCustomerId,
        invoice: mockInvoice.id,
        currency: "usd",
        description: "Akash Network Console"
      });
      expect(stripe.invoices.finalizeInvoice).toHaveBeenCalledWith(mockInvoice.id);

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

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();

      expect(result).toEqual({
        coupon: mockPromotionCode,
        amountAdded: 10, // 1000 cents = $10
        transactionId: "test-transaction-id",
        transactionStatus: "pending"
      });
    });

    it("creates a Stripe customer before redeeming when the account has none, then applies the coupon", async () => {
      const { service, stripe, userRepository, stripeTransactionRepository } = setup();
      const mockUser = createTestUser({ stripeCustomerId: null });
      const createdCustomer = mock<Stripe.Response<Stripe.Customer>>({ id: "cus_new_456" });
      const mockCoupon = createTestCoupon({
        id: "coupon_new",
        amount_off: 1000,
        percent_off: null,
        valid: true,
        currency: "usd",
        name: "New User Coupon"
      });
      const mockPromotionCode = createTestPromotionCode({
        id: "promo_new",
        promotion: {
          type: "coupon",
          coupon: mockCoupon
        }
      });
      const mockInvoice = createTestInvoice({ id: "in_new", status: "draft" });

      vi.spyOn(stripe.customers, "create").mockResolvedValue(createdCustomer);
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_new", status: "paid" }));

      const result = await service.applyCoupon(mockUser, mockPromotionCode.code);

      expect(stripe.customers.create).toHaveBeenCalledWith(
        {
          email: mockUser.email,
          name: mockUser.username,
          metadata: { userId: mockUser.id }
        },
        { idempotencyKey: `create-customer:${mockUser.id}` }
      );
      expect(userRepository.updateBy).toHaveBeenCalledWith(
        { id: mockUser.id, stripeCustomerId: null },
        { stripeCustomerId: "cus_new_456" },
        { returning: true }
      );
      expect(stripe.invoices.create).toHaveBeenCalledWith({
        customer: "cus_new_456",
        auto_advance: false,
        discounts: [{ promotion_code: mockPromotionCode.id }]
      });
      expect(stripe.invoiceItems.create).toHaveBeenCalledWith({
        amount: 1000,
        customer: "cus_new_456",
        invoice: mockInvoice.id,
        currency: "usd",
        description: "Akash Network Console"
      });
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

      expect(result).toEqual({
        coupon: mockPromotionCode,
        amountAdded: 10,
        transactionId: "test-transaction-id",
        transactionStatus: "pending"
      });
    });

    it("applies coupon successfully when no promotion code found", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
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

      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      vi.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(mockFinalizedInvoice);

      const result = await service.applyCoupon(mockUser, mockCoupon.id);

      expect(stripe.invoices.create).toHaveBeenCalledWith({
        customer: mockUser.stripeCustomerId,
        auto_advance: false,
        discounts: [{ coupon: mockCoupon.id }]
      });
      expect(stripe.invoiceItems.create).toHaveBeenCalledWith({
        amount: 500,
        customer: mockUser.stripeCustomerId,
        invoice: mockInvoice.id,
        currency: "usd",
        description: "Akash Network Console"
      });
      expect(stripe.invoices.finalizeInvoice).toHaveBeenCalledWith(mockInvoice.id);

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

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();

      expect(result).toEqual({
        coupon: mockCoupon,
        amountAdded: 5, // 500 cents = $5
        transactionId: "test-transaction-id",
        transactionStatus: "pending"
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
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);

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
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);

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
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      vi.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });

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
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      vi.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });

      await expect(service.applyCoupon(mockUser, mockCoupon.id)).rejects.toThrow("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("throws error for invalid promotion code", async () => {
      const { service, stripe } = setup();
      const mockUser = createTestUser();
      vi.spyOn(stripe.promotionCodes, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>);
      vi.spyOn(stripe.coupons, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);

      await expect(service.applyCoupon(mockUser, "INVALID_CODE")).rejects.toThrow("No valid promotion code or coupon found with the provided code");
    });

    it("does not provision a Stripe customer for a brand-new account when no matching code is found", async () => {
      const { service, stripe } = setup();
      const mockUser = createTestUser({ stripeCustomerId: null });
      vi.spyOn(stripe.promotionCodes, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>);
      vi.spyOn(stripe.coupons, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);

      await expect(service.applyCoupon(mockUser, "INVALID_CODE")).rejects.toThrow("No valid promotion code or coupon found with the provided code");

      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("does not provision a Stripe customer for a brand-new account when the coupon is unsupported", async () => {
      const { service, stripe } = setup();
      const mockUser = createTestUser({ stripeCustomerId: null });
      const mockCoupon = createTestCoupon({ percent_off: 20, amount_off: null, valid: true });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      vi.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });

      await expect(service.applyCoupon(mockUser, mockCoupon.id)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );

      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("voids invoice on error after invoice is created", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
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

      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockRejectedValue(new Error("Invoice item creation failed"));
      vi.spyOn(stripe.invoices, "voidInvoice").mockResolvedValue(mock<Stripe.Response<Stripe.Invoice>>());

      await expect(service.applyCoupon(mockUser, mockPromotionCode.code)).rejects.toThrow("Invoice item creation failed");

      expect(stripe.invoices.voidInvoice).toHaveBeenCalledWith(mockInvoice.id);
      expect(stripeTransactionRepository.create).not.toHaveBeenCalled();
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

  describe("getPaymentMethods", () => {
    it("returns customer payment methods", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
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
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({ data: mockPaymentMethods } as unknown as Stripe.Response<
        Stripe.ApiList<Stripe.PaymentMethod>
      >);
      paymentMethodRepository.findByUserId.mockResolvedValue([]);

      const result = await service.getPaymentMethods(
        TEST_CONSTANTS.USER_ID,
        TEST_CONSTANTS.CUSTOMER_ID,
        createMongoAbility([{ action: "read", subject: "PaymentMethod" }])
      );
      expect(stripe.paymentMethods.list).toHaveBeenCalledWith({
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

  describe("listCoupons", () => {
    it("returns coupons", async () => {
      const { service, stripe } = setup();
      const mockCoupons = [
        { id: TEST_CONSTANTS.COUPON_ID, percent_off: 50 },
        { id: "coupon_456", amount_off: 1000 }
      ];
      vi.spyOn(stripe.coupons, "list").mockResolvedValue({ data: mockCoupons } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);

      const result = await service.listCoupons();
      expect(stripe.coupons.list).toHaveBeenCalledWith({
        limit: 100
      });
      expect(result).toEqual({ coupons: mockCoupons });
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

    it("should extract fingerprint from link payment method email", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = TEST_CONSTANTS.USER_ID;
      const expectedFingerprint = `link_${crypto.createHash("sha256").update("user@test.com").digest("hex")}`;
      const paymentMethods = [
        generatePaymentMethod({
          id: "pm_link",
          type: "link",
          card: null,
          link: { email: "User@Test.com" }
        } as unknown as Parameters<typeof generatePaymentMethod>[0])
      ];

      paymentMethodRepository.findOthersTrialingByFingerprint.mockResolvedValue(undefined);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOthersTrialingByFingerprint).toHaveBeenCalledWith([expectedFingerprint], currentUserId);
    });

    it("should handle mixed card and link payment methods", async () => {
      const { service, paymentMethodRepository } = setup();
      const currentUserId = TEST_CONSTANTS.USER_ID;
      const expectedLinkFingerprint = `link_${crypto.createHash("sha256").update("user@test.com").digest("hex")}`;
      const paymentMethods = [
        generatePaymentMethod({
          id: "pm_card",
          card: { fingerprint: "fp_card_123" }
        }),
        generatePaymentMethod({
          id: "pm_link",
          type: "link",
          card: null,
          link: { email: "user@test.com" }
        } as unknown as Parameters<typeof generatePaymentMethod>[0])
      ];

      paymentMethodRepository.findOthersTrialingByFingerprint.mockResolvedValue(undefined);

      const result = await service.hasDuplicateTrialAccount(paymentMethods, currentUserId);

      expect(result).toBe(false);
      expect(paymentMethodRepository.findOthersTrialingByFingerprint).toHaveBeenCalledWith(["fp_card_123", expectedLinkFingerprint], currentUserId);
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
      const { service, stripe, paymentMethodRepository, userRepository } = setup();
      const mockUser = createTestUser();
      const mockPaymentIntent = createTestPaymentIntent({ status: "succeeded", amount: 0 });

      vi.spyOn(userRepository, "findOneBy").mockResolvedValue(mockUser);
      paymentMethodRepository.findValidatedByUserId.mockResolvedValue([]);
      vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue(mockPaymentIntent);
      paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);

      const result = await service.createTestCharge(mockParams);

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
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
      const mockUser = createUser({ id: "user_123", stripeCustomerId: "cus_123" });
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
      const { service, stripe } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "requires_payment_method",
        last_payment_error: {
          message: "Your card was declined."
        }
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Override default payment intent mock
      vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      const result = await service.createTestCharge(mockParams);

      expect(result).toEqual({
        success: false,
        paymentIntentId: mockPaymentIntent.id
      });
    });

    it("handles payment intent with requires_capture status", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const mockUser = createUser({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "requires_capture",
        amount: 100
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Override default payment intent mock
      vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

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
      const { service, stripe } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "processing",
        amount: 100
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Override default payment intent mock
      vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

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
      const { service, stripe, paymentMethodRepository } = setup();
      const mockPaymentIntent = {
        id: "pi_test_123",
        status: "succeeded",
        amount: 100
      } as Stripe.PaymentIntent;

      // Override default payment intent mock
      vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

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
      const { service, stripe } = setup();
      const creationError = new Error("Payment failed");

      vi.spyOn(stripe.paymentIntents, "create").mockRejectedValue(creationError);

      await expect(service.createTestCharge(mockParams)).rejects.toThrow("Payment failed");
    });
  });

  describe("validatePaymentMethodAfter3DS", () => {
    const mockParams = {
      customerId: "cus_123",
      paymentMethodId: "pm_123",
      paymentIntentId: "pi_123"
    };

    it("marks payment method as validated when payment intent succeeded", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const mockUser = createUser({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPaymentIntent = {
        id: "pi_123",
        status: "succeeded",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);

      const result = await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(result).toEqual({ success: true });
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(mockParams.paymentMethodId, mockUser.id);
    });

    it("marks payment method as validated when payment intent requires_capture", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const mockUser = createUser({ id: "user_123", stripeCustomerId: "cus_123" });
      const mockPaymentIntent = {
        id: "pi_123",
        status: "requires_capture",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      // Mock payment method validation
      paymentMethodRepository.markAsValidated.mockResolvedValue(undefined);

      const result = await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(result).toEqual({ success: true });
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(mockParams.paymentMethodId, mockUser.id);
    });

    it("logs warning when payment intent is not successful", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const mockPaymentIntent = {
        id: "pi_123",
        status: "requires_payment_method",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      const result = await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(result).toEqual({ success: false });
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).not.toHaveBeenCalled();
    });

    it("handles payment intent retrieval failure", async () => {
      const { service, stripe } = setup();
      const retrievalError = new Error("Payment intent not found");

      // Mock payment intent retrieval to fail
      vi.spyOn(stripe.paymentIntents, "retrieve").mockRejectedValue(retrievalError);

      await expect(service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId)).rejects.toThrow(
        "Payment intent not found"
      );
    });

    it("handles user not found during validation", async () => {
      const { service, stripe, paymentMethodRepository } = setup({ user: undefined });
      const mockPaymentIntent = {
        id: "pi_123",
        status: "succeeded",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      const result = await service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId);

      expect(result).toEqual({ success: true });
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(mockParams.paymentIntentId);
      expect(paymentMethodRepository.markAsValidated).not.toHaveBeenCalled();
    });

    it("throws error when payment intent belongs to different customer", async () => {
      const { service, stripe } = setup();
      const mockPaymentIntent = {
        id: "pi_123",
        status: "succeeded",
        customer: "cus_different",
        payment_method: "pm_123",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      await expect(service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId)).rejects.toThrow(
        "Payment intent does not belong to the user"
      );
    });

    it("throws error when payment intent references different payment method", async () => {
      const { service, stripe } = setup();
      const mockPaymentIntent = {
        id: "pi_123",
        status: "succeeded",
        customer: "cus_123",
        payment_method: "pm_different",
        metadata: {}
      } as Partial<Stripe.PaymentIntent> as Stripe.PaymentIntent;

      // Mock payment intent retrieval
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(mockPaymentIntent as unknown as Stripe.Response<Stripe.PaymentIntent>);

      await expect(service.validatePaymentMethodAfter3DS(mockParams.customerId, mockParams.paymentMethodId, mockParams.paymentIntentId)).rejects.toThrow(
        "Payment intent does not reference the provided payment method"
      );
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
    paymentMethodValidation?: any[];
  } = {}
) {
  const billingConfig = mock<BillingConfigService>({ get: vi.fn().mockReturnValue("sk_live_key") });
  const userRepository = mock<UserRepository>();
  const paymentMethodRepository = mock<PaymentMethodRepository>();
  const stripeTransactionRepository = mock<StripeTransactionRepository>();

  const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });

  const service = new StripeService(billingConfig, userRepository, paymentMethodRepository, stripeTransactionRepository, stripe, () => mock<LoggerService>());

  // Setup stripe transaction repository mocks
  stripeTransactionRepository.create.mockImplementation(async input => ({
    id: "test-transaction-id",
    userId: input.userId,
    type: input.type,
    status: input.status ?? "created",
    amount: input.amount,
    amountRefunded: input.amountRefunded ?? 0,
    bonusAmount: input.bonusAmount ?? 0,
    currency: input.currency ?? "usd",
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeChargeId: input.stripeChargeId ?? null,
    stripeCouponId: input.stripeCouponId ?? null,
    stripePromotionCodeId: input.stripePromotionCodeId ?? null,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
    stripeIdempotencyKey: input.stripeIdempotencyKey ?? null,
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
  stripeTransactionRepository.findByChargeIds.mockResolvedValue([]);
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
    billingConfig,
    paymentMethodRepository,
    stripeTransactionRepository
  };
}
