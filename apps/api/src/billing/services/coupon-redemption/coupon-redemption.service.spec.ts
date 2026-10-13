import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CouponClaimHold, StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import type { CustomerService } from "@src/billing/services/customer/customer.service";
import type { Payer } from "@src/billing/services/payer/payer";
import type { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import type { TxService } from "@src/core";
import type { UserOutput } from "@src/user/repositories";
import { CouponRedemptionService } from "./coupon-redemption.service";

import { createTeamPayer } from "@test/seeders/payer.seeder";
import { createTestCoupon, createTestInvoice, createTestPromotionCode } from "@test/seeders/stripe-test-data.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";

function payerOf(user: UserOutput): Payer {
  return { user, stripeCustomerId: user.stripeCustomerId };
}

describe(CouponRedemptionService.name, () => {
  describe("redeemCoupon", () => {
    it("applies a promotion code, creates the discounted invoice, and records a pending coupon_claim", async () => {
      const { service, stripe, stripeTransactionService } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({ id: "coupon_123", amount_off: 1000, percent_off: null, valid: true, currency: "usd", name: "Test Coupon" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_123", promotion: { type: "coupon", coupon: mockCoupon } });
      const mockInvoice = createTestInvoice({ id: "in_123", status: "draft" });

      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_123", status: "paid" }));

      const result = await service.redeemCoupon(payerOf(mockUser), mockPromotionCode.code);

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
      expect(stripeTransactionService.recordCouponClaim).toHaveBeenCalledWith({
        userId: mockUser.id,
        amount: 1000,
        currency: "usd",
        couponId: mockCoupon.id,
        promotionCodeId: mockPromotionCode.id,
        description: `Coupon: ${mockCoupon.name}`
      });
      expect(result).toEqual({ coupon: mockPromotionCode, amountAdded: 10, transactionId: "test-transaction-id", transactionStatus: "pending" });
    });

    it("charges a team organization's customer and records the claim for the team and the member who redeemed it", async () => {
      const { service, stripe, stripeTransactionService } = setup();
      const payer = createTeamPayer();
      const mockCoupon = createTestCoupon({ id: "coupon_team", amount_off: 1000, percent_off: null, valid: true, currency: "usd", name: "Team Coupon" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_team", promotion: { type: "coupon", coupon: mockCoupon } });
      const mockInvoice = createTestInvoice({ id: "in_team", status: "draft" });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_team", status: "paid" }));

      await service.redeemCoupon(payer, mockPromotionCode.code);

      expect(stripe.invoices.create).toHaveBeenCalledWith(expect.objectContaining({ customer: payer.stripeCustomerId }));
      expect(stripeTransactionService.recordCouponClaim).toHaveBeenCalledWith(
        expect.objectContaining({ userId: payer.user.id, organizationId: payer.team!.id, couponId: "coupon_team" })
      );
    });

    it("refuses a coupon the person already claimed for another payer, before creating any invoice", async () => {
      const { service, stripe, stripeTransactionRepository, stripeTransactionService } = setup();
      const payer = createTeamPayer();
      const mockCoupon = createTestCoupon({ id: "coupon_once", amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_once", promotion: { type: "coupon", coupon: mockCoupon } });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      const createInvoice = vi.spyOn(stripe.invoices, "create");
      stripeTransactionRepository.findCouponClaimsOutside.mockResolvedValue([heldClaim({ status: "succeeded" })]);

      await expect(service.redeemCoupon(payer, mockPromotionCode.code)).rejects.toThrow("Promotion code has already been used");

      expect(stripeTransactionRepository.findCouponClaimsOutside).toHaveBeenCalledWith({
        userId: payer.user.id,
        couponId: "coupon_once",
        owner: { organizationId: payer.team!.id }
      });
      expect(createInvoice).not.toHaveBeenCalled();
      expect(stripeTransactionService.recordCouponClaim).not.toHaveBeenCalled();
    });

    it("looks for the person's claims outside their own payments when they redeem for themselves", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({ id: "coupon_own", amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_own", promotion: { type: "coupon", coupon: mockCoupon } });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(createTestInvoice({ id: "in_own", status: "draft" }));
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_own", status: "paid" }));

      await service.redeemCoupon(payerOf(mockUser), mockPromotionCode.code);

      expect(stripeTransactionRepository.findCouponClaimsOutside).toHaveBeenCalledWith({
        userId: mockUser.id,
        couponId: "coupon_own",
        owner: { userId: mockUser.id }
      });
    });

    it("records the pending coupon_claim before finalizing the invoice so the invoice.paid webhook can find it", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({ id: "coupon_order", amount_off: 1000, percent_off: null, valid: true, currency: "usd", name: "Order Coupon" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_order", promotion: { type: "coupon", coupon: mockCoupon } });
      const mockInvoice = createTestInvoice({ id: "in_order", status: "draft" });

      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      const finalizeInvoice = vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_order", status: "paid" }));

      await service.redeemCoupon(payerOf(mockUser), mockPromotionCode.code);

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("test-transaction-id", { stripeInvoiceId: "in_order" });
      expect(stripeTransactionRepository.updateById.mock.invocationCallOrder[0]).toBeLessThan(finalizeInvoice.mock.invocationCallOrder[0]);
    });

    it("provisions a Stripe customer via getStripeCustomerId before redeeming when the account has none", async () => {
      const { service, stripe, customerService, stripeTransactionService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: null });
      customerService.getStripeCustomerId.mockResolvedValue("cus_new_456");
      const mockCoupon = createTestCoupon({ id: "coupon_new", amount_off: 1000, percent_off: null, valid: true, currency: "usd", name: "New User Coupon" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_new", promotion: { type: "coupon", coupon: mockCoupon } });
      const mockInvoice = createTestInvoice({ id: "in_new", status: "draft" });

      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_new", status: "paid" }));

      const payer = payerOf(mockUser);

      await service.redeemCoupon(payer, mockPromotionCode.code);

      expect(customerService.getStripeCustomerId).toHaveBeenCalledWith(payer);
      expect(stripe.invoices.create).toHaveBeenCalledWith({
        customer: "cus_new_456",
        auto_advance: false,
        discounts: [{ promotion_code: mockPromotionCode.id }]
      });
      expect(stripeTransactionService.recordCouponClaim).toHaveBeenCalledWith(expect.objectContaining({ userId: mockUser.id, couponId: mockCoupon.id }));
    });

    it("falls back to a matching coupon when no promotion code is found", async () => {
      const { service, stripe, stripeTransactionService } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({ id: "coupon_direct", amount_off: 500, percent_off: null, valid: true, currency: "usd", name: "Direct Coupon" });
      const mockInvoice = createTestInvoice({ id: "in_456", status: "draft" });

      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      vi.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_456", status: "paid" }));

      const result = await service.redeemCoupon(payerOf(mockUser), mockCoupon.id);

      expect(stripe.invoices.create).toHaveBeenCalledWith({ customer: mockUser.stripeCustomerId, auto_advance: false, discounts: [{ coupon: mockCoupon.id }] });
      expect(stripeTransactionService.recordCouponClaim).toHaveBeenCalledWith({
        userId: mockUser.id,
        amount: 500,
        currency: "usd",
        couponId: mockCoupon.id,
        promotionCodeId: undefined,
        description: `Coupon: ${mockCoupon.name}`
      });
      expect(result).toEqual({ coupon: mockCoupon, amountAdded: 5, transactionId: "test-transaction-id", transactionStatus: "pending" });
    });

    it("rejects percentage-based promotion codes", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockPromotionCode = createTestPromotionCode({
        promotion: { type: "coupon", coupon: { ...createTestCoupon(), percent_off: 20, amount_off: null, valid: true } }
      });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);

      await expect(service.redeemCoupon(payerOf(mockUser), mockPromotionCode.code)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );
    });

    it("rejects promotion codes without amount_off", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockPromotionCode = createTestPromotionCode({
        promotion: { type: "coupon", coupon: { ...createTestCoupon(), percent_off: null, amount_off: null, valid: true } }
      });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);

      await expect(service.redeemCoupon(payerOf(mockUser), mockPromotionCode.code)).rejects.toThrow(
        "Invalid coupon type. Only fixed amount coupons are supported."
      );
    });

    it("rejects percentage-based coupons", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({ percent_off: 20, amount_off: null, valid: true });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      vi.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });

      await expect(service.redeemCoupon(payerOf(mockUser), mockCoupon.id)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );
    });

    it("rejects coupons without amount_off", async () => {
      const { service } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({ percent_off: null, amount_off: null, valid: true });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      vi.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });

      await expect(service.redeemCoupon(payerOf(mockUser), mockCoupon.id)).rejects.toThrow("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("throws when no promotion code or coupon matches the code", async () => {
      const { service, stripe } = setup();
      const mockUser = createTestUser();
      vi.spyOn(stripe.promotionCodes, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>);
      vi.spyOn(stripe.coupons, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);

      await expect(service.redeemCoupon(payerOf(mockUser), "INVALID_CODE")).rejects.toThrow("No valid promotion code or coupon found with the provided code");
    });

    it("does not provision a Stripe customer when no matching code is found", async () => {
      const { service, stripe, customerService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: null });
      vi.spyOn(stripe.promotionCodes, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>);
      vi.spyOn(stripe.coupons, "list").mockResolvedValue({ data: [] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Coupon>>);

      await expect(service.redeemCoupon(payerOf(mockUser), "INVALID_CODE")).rejects.toThrow("No valid promotion code or coupon found with the provided code");

      expect(customerService.getStripeCustomerId).not.toHaveBeenCalled();
    });

    it("does not provision a Stripe customer when the coupon is unsupported", async () => {
      const { service, customerService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: null });
      const mockCoupon = createTestCoupon({ percent_off: 20, amount_off: null, valid: true });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(undefined);
      vi.spyOn(service, "listCoupons").mockResolvedValue({ coupons: [mockCoupon] });

      await expect(service.redeemCoupon(payerOf(mockUser), mockCoupon.id)).rejects.toThrow(
        "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
      );

      expect(customerService.getStripeCustomerId).not.toHaveBeenCalled();
    });

    it("deletes the draft invoice and releases the claim when the invoice flow fails before finalizing", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({ id: "coupon_123", amount_off: 1000, percent_off: null, valid: true, currency: "usd", name: "Test Coupon" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_123", promotion: { type: "coupon", coupon: mockCoupon } });
      const mockInvoice = createTestInvoice({ id: "in_123", status: "draft" });

      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(mockInvoice);
      vi.spyOn(stripe.invoiceItems, "create").mockRejectedValue(new Error("Invoice item creation failed"));
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(mockInvoice);
      const deleteInvoice = vi.spyOn(stripe.invoices, "del").mockResolvedValue(mock());
      const voidInvoice = vi.spyOn(stripe.invoices, "voidInvoice");

      await expect(service.redeemCoupon(payerOf(mockUser), mockPromotionCode.code)).rejects.toThrow("Invoice item creation failed");

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("test-transaction-id", { stripeInvoiceId: mockInvoice.id });
      expect(deleteInvoice).toHaveBeenCalledWith(mockInvoice.id);
      expect(voidInvoice).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("test-transaction-id", { status: "failed" });
    });

    it("voids an open invoice and releases the claim when finalizing fails after Stripe finalized it", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const mockCoupon = createTestCoupon({ id: "coupon_open", amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_open", promotion: { type: "coupon", coupon: mockCoupon } });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(createTestInvoice({ id: "in_open", status: "draft" }));
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockRejectedValue(new Error("timed out"));
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_open", status: "open" }));
      const voidInvoice = vi.spyOn(stripe.invoices, "voidInvoice").mockResolvedValue(mock());

      await expect(service.redeemCoupon(payerOf(createTestUser()), mockPromotionCode.code)).rejects.toThrow("timed out");

      expect(voidInvoice).toHaveBeenCalledWith("in_open");
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("test-transaction-id", { status: "failed" });
    });

    it("keeps the claim when the invoice turns out to be paid", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const mockCoupon = createTestCoupon({ id: "coupon_kept", amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_kept", promotion: { type: "coupon", coupon: mockCoupon } });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(createTestInvoice({ id: "in_kept", status: "draft" }));
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockRejectedValue(new Error("timed out"));
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_kept", status: "paid" }));
      const voidInvoice = vi.spyOn(stripe.invoices, "voidInvoice");

      await expect(service.redeemCoupon(payerOf(createTestUser()), mockPromotionCode.code)).rejects.toThrow("timed out");

      expect(voidInvoice).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalledWith("test-transaction-id", { status: "failed" });
    });

    it("keeps the claim when Stripe cannot say what became of the invoice", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const mockCoupon = createTestCoupon({ id: "coupon_unknown", amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_unknown", promotion: { type: "coupon", coupon: mockCoupon } });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(createTestInvoice({ id: "in_unknown", status: "draft" }));
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockRejectedValue(new Error("timed out"));
      vi.spyOn(stripe.invoices, "retrieve").mockRejectedValue(new Error("stripe unavailable"));

      await expect(service.redeemCoupon(payerOf(createTestUser()), mockPromotionCode.code)).rejects.toThrow("timed out");

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalledWith("test-transaction-id", { status: "failed" });
    });

    it("keeps the original failure when releasing the claim fails too", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const mockCoupon = createTestCoupon({ id: "coupon_123", amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_123", promotion: { type: "coupon", coupon: mockCoupon } });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockRejectedValue(new Error("stripe unavailable"));
      stripeTransactionRepository.updateById.mockRejectedValue(new Error("db unavailable"));

      await expect(service.redeemCoupon(payerOf(createTestUser()), mockPromotionCode.code)).rejects.toThrow("stripe unavailable");
    });

    it("locks the person's claims of the coupon before checking them again and recording one", async () => {
      const { service, stripe, stripeTransactionRepository, stripeTransactionService } = setup();
      const mockUser = createTestUser();
      const mockCoupon = createTestCoupon({ id: "coupon_lock", amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
      const mockPromotionCode = createTestPromotionCode({ id: "promo_lock", promotion: { type: "coupon", coupon: mockCoupon } });
      vi.spyOn(service, "findPromotionCodeByCode").mockResolvedValue(mockPromotionCode);
      vi.spyOn(stripe.invoices, "create").mockResolvedValue(createTestInvoice({ id: "in_lock", status: "draft" }));
      vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_lock", status: "paid" }));

      await service.redeemCoupon(payerOf(mockUser), mockPromotionCode.code);

      expect(stripeTransactionRepository.lockCouponClaims).toHaveBeenCalledWith(mockUser.id, "coupon_lock");
      expect(stripeTransactionRepository.lockCouponClaims.mock.invocationCallOrder[0]).toBeLessThan(
        stripeTransactionRepository.findCouponClaimsOutside.mock.invocationCallOrder[1]
      );
      expect(stripeTransactionRepository.findCouponClaimsOutside.mock.invocationCallOrder[1]).toBeLessThan(
        stripeTransactionService.recordCouponClaim.mock.invocationCallOrder[0]
      );
    });
  });

  describe("when the person's claim under another payer is stale", () => {
    it.each([
      { status: "draft" as const, cancel: "del" as const },
      { status: "open" as const, cancel: "voidInvoice" as const },
      { status: "uncollectible" as const, cancel: "voidInvoice" as const }
    ])("cancels its $status invoice and commits the release before opening the claim transaction", async ({ status, cancel }) => {
      const { service, stripe, stripeTransactionRepository, stripeTransactionService, txService, code } = setupRedeemable();
      stripeTransactionRepository.findCouponClaimsOutside.mockResolvedValueOnce([staleClaim()]).mockResolvedValueOnce([]);
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_stale", status }));
      const cancelInvoice = vi.spyOn(stripe.invoices, cancel).mockResolvedValue(mock());

      await service.redeemCoupon(payerOf(createTestUser()), code);

      expect(cancelInvoice).toHaveBeenCalledWith("in_stale");
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("stale-claim", { status: "failed" });
      expect(stripeTransactionRepository.updateById.mock.invocationCallOrder[0]).toBeLessThan(txService.transaction.mock.invocationCallOrder[0]);
      expect(stripeTransactionService.recordCouponClaim).toHaveBeenCalled();
    });

    it.each([
      { case: "is already void", answer: () => Promise.resolve(createTestInvoice({ id: "in_stale", status: "void" })) },
      { case: "no longer exists at Stripe", answer: () => Promise.reject(resourceMissing()) }
    ])("releases it without cancelling anything when its invoice $case", async ({ answer }) => {
      const { service, stripe, stripeTransactionRepository, stripeTransactionService, code } = setupRedeemable();
      stripeTransactionRepository.findCouponClaimsOutside.mockResolvedValueOnce([staleClaim()]).mockResolvedValueOnce([]);
      vi.spyOn(stripe.invoices, "retrieve").mockImplementation(answer);
      const voidInvoice = vi.spyOn(stripe.invoices, "voidInvoice");
      const deleteInvoice = vi.spyOn(stripe.invoices, "del");

      await service.redeemCoupon(payerOf(createTestUser()), code);

      expect(voidInvoice).not.toHaveBeenCalled();
      expect(deleteInvoice).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("stale-claim", { status: "failed" });
      expect(stripeTransactionService.recordCouponClaim).toHaveBeenCalled();
    });

    it("keeps the release when a later step of the redemption fails", async () => {
      const { service, stripe, stripeTransactionRepository, stripeTransactionService, code } = setupRedeemable();
      stripeTransactionRepository.findCouponClaimsOutside.mockResolvedValueOnce([staleClaim()]).mockResolvedValueOnce([]);
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_stale", status: "draft" }));
      vi.spyOn(stripe.invoices, "del").mockResolvedValue(mock());
      stripeTransactionService.recordCouponClaim.mockRejectedValue(new Error("db unavailable"));

      await expect(service.redeemCoupon(payerOf(createTestUser()), code)).rejects.toThrow("db unavailable");

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith("stale-claim", { status: "failed" });
    });

    it("refuses this redemption when the stale claim's invoice was paid", async () => {
      const { service, stripe, stripeTransactionRepository, stripeTransactionService, code } = setupRedeemable();
      stripeTransactionRepository.findCouponClaimsOutside.mockResolvedValue([staleClaim()]);
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_stale", status: "paid" }));

      await expect(service.redeemCoupon(payerOf(createTestUser()), code)).rejects.toThrow("Promotion code has already been used");

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(stripeTransactionService.recordCouponClaim).not.toHaveBeenCalled();
    });

    it("refuses this redemption when Stripe cannot tell what became of the stale claim's invoice", async () => {
      const { service, stripe, stripeTransactionRepository, stripeTransactionService, code } = setupRedeemable();
      stripeTransactionRepository.findCouponClaimsOutside.mockResolvedValue([staleClaim()]);
      vi.spyOn(stripe.invoices, "retrieve").mockRejectedValue(new Error("stripe unavailable"));

      await expect(service.redeemCoupon(payerOf(createTestUser()), code)).rejects.toThrow("Promotion code has already been used");

      expect(stripeTransactionService.recordCouponClaim).not.toHaveBeenCalled();
    });

    it("touches nothing at Stripe when another claim holds the coupon anyway", async () => {
      const { service, stripe, stripeTransactionRepository, code } = setupRedeemable();
      stripeTransactionRepository.findCouponClaimsOutside.mockResolvedValue([staleClaim(), heldClaim({ isStale: false, stripeInvoiceId: "in_fresh" })]);
      const retrieve = vi.spyOn(stripe.invoices, "retrieve");

      await expect(service.redeemCoupon(payerOf(createTestUser()), code)).rejects.toThrow("Promotion code has already been used");

      expect(retrieve).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
    });

    function staleClaim() {
      return heldClaim({ id: "stale-claim", isStale: true, stripeInvoiceId: "in_stale" });
    }

    function resourceMissing() {
      return new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        code: "resource_missing",
        message: "No such invoice"
      } as Stripe.StripeRawError);
    }

    function setupRedeemable() {
      const context = setup();
      const coupon = createTestCoupon({ id: "coupon_stale", amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
      const promotionCode = createTestPromotionCode({ id: "promo_stale", promotion: { type: "coupon", coupon } });
      vi.spyOn(context.service, "findPromotionCodeByCode").mockResolvedValue(promotionCode);
      vi.spyOn(context.stripe.invoices, "create").mockResolvedValue(createTestInvoice({ id: "in_new", status: "draft" }));
      vi.spyOn(context.stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      vi.spyOn(context.stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_new", status: "paid" }));

      return { ...context, code: promotionCode.code };
    }
  });

  function heldClaim(overrides: Partial<CouponClaimHold> = {}): CouponClaimHold {
    return { id: faker.string.uuid(), status: "pending", stripeInvoiceId: null, isStale: false, ...overrides };
  }

  function setup() {
    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });
    const customerService = mock<CustomerService>();
    const stripeTransactionService = mock<StripeTransactionService>();

    customerService.getStripeCustomerId.mockImplementation(async payer => payer.stripeCustomerId ?? "cus_provisioned");
    stripeTransactionService.recordCouponClaim.mockResolvedValue(
      mock<StripeTransactionOutput>({ id: "test-transaction-id", status: "pending", type: "coupon_claim" })
    );

    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.findCouponClaimsOutside.mockResolvedValue([]);

    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());

    const service = new CouponRedemptionService(stripe, customerService, stripeTransactionService, stripeTransactionRepository, txService, () =>
      mock<LoggerService>()
    );

    return { service, stripe, customerService, stripeTransactionService, stripeTransactionRepository, txService };
  }
});
