import type { LoggerService } from "@akashnetwork/logging";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { type CouponClaimHold, StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { CustomerService } from "@src/billing/services/customer/customer.service";
import { billingOwnerOf, type Payer } from "@src/billing/services/payer/payer";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { type CreateLogger, LOGGER_FACTORY, TxService } from "@src/core";

@singleton()
export class CouponRedemptionService {
  private readonly loggerService: LoggerService;

  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly customerService: CustomerService,
    private readonly stripeTransactionService: StripeTransactionService,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: CouponRedemptionService.name });
  }

  async findPromotionCodeByCode(code: string): Promise<Stripe.PromotionCode | undefined> {
    const { data: promotionCodes } = await this.stripe.promotionCodes.list({
      code,
      expand: ["data.promotion.coupon"]
    });

    return promotionCodes[0];
  }

  async listCoupons() {
    const coupons = await this.stripe.coupons.list({
      limit: 100
    });
    return { coupons: coupons.data };
  }

  async redeemCoupon(
    payer: Payer,
    couponCode: string
  ): Promise<{
    coupon: Stripe.Coupon | Stripe.PromotionCode;
    amountAdded: number;
    transactionId: string;
    transactionStatus: StripeTransactionOutput["status"];
  }> {
    const promotionCode = await this.findPromotionCodeByCode(couponCode);

    if (promotionCode) {
      const coupon = promotionCode.promotion.coupon;

      if (typeof coupon === "string" || !coupon) {
        throw new Error("Promotion code coupon was not expanded");
      }

      return this.redeemCouponOrPromotionCode({
        payer,
        couponOrPromotion: promotionCode,
        coupon,
        updateField: "promotion_code",
        updateId: promotionCode.id
      });
    }

    // If no promotion code found, try to find a matching coupon
    const { coupons } = await this.listCoupons();
    const matchingCoupon = coupons.find(coupon => coupon.id === couponCode);

    if (matchingCoupon) {
      return this.redeemCouponOrPromotionCode({
        payer,
        couponOrPromotion: matchingCoupon,
        coupon: matchingCoupon,
        updateField: "coupon",
        updateId: matchingCoupon.id
      });
    }

    throw new Error("No valid promotion code or coupon found with the provided code");
  }

  /** Every organization pays with its own Stripe customer, so a person's claims under any other payer count too. */
  async #claimCoupon(
    payer: Payer,
    claim: { amount: number; currency: string; couponId: string; promotionCodeId?: string; description: string }
  ): Promise<StripeTransactionOutput> {
    const lookup = { userId: payer.user.id, couponId: claim.couponId, owner: billingOwnerOf(payer) };

    await this.#releaseStaleClaims(await this.stripeTransactionRepository.findCouponClaimsOutside(lookup));

    return await this.txService.transaction(async () => {
      await this.stripeTransactionRepository.lockCouponClaims(payer.user.id, claim.couponId);

      if ((await this.stripeTransactionRepository.findCouponClaimsOutside(lookup)).length > 0) {
        throw new Error("Promotion code has already been used");
      }

      return await this.stripeTransactionService.recordCouponClaim({ userId: payer.user.id, organizationId: payer.organizationId, ...claim });
    });
  }

  /** Runs outside any transaction and commits each release right after Stripe cancels its invoice, so no Stripe call can outlive a rolled-back write. */
  async #releaseStaleClaims(claims: CouponClaimHold[]): Promise<void> {
    if (!claims.every(isStaleWithInvoice)) {
      return;
    }

    for (const claim of claims.filter(isStaleWithInvoice)) {
      await this.#releaseIfUnpaid(claim.id, claim.stripeInvoiceId);
    }
  }

  async #releaseIfUnpaid(transactionId: string, invoiceId: string): Promise<void> {
    try {
      if (await this.#cancelUnpaidInvoice(invoiceId)) {
        await this.stripeTransactionRepository.updateById(transactionId, { status: "failed" });
        this.loggerService.info({ event: "STALE_COUPON_CLAIM_RELEASED", transactionId, invoiceId });
      }
    } catch (error) {
      this.loggerService.error({ event: "STALE_COUPON_CLAIM_RESOLUTION_FAILED", transactionId, invoiceId, error });
    }
  }

  /** Returns whether the invoice can no longer be paid: deleted, voided now or already, while a paid one is left alone. */
  async #cancelUnpaidInvoice(invoiceId: string): Promise<boolean> {
    const invoice = await this.#retrieveInvoice(invoiceId);

    switch (invoice?.status) {
      case undefined:
      case "void":
        return true;
      case "draft":
        await this.stripe.invoices.del(invoiceId);
        return true;
      case "open":
      case "uncollectible":
        await this.stripe.invoices.voidInvoice(invoiceId);
        return true;
      default:
        return false;
    }
  }

  async #retrieveInvoice(invoiceId: string): Promise<Stripe.Invoice | undefined> {
    try {
      return await this.stripe.invoices.retrieve(invoiceId);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return undefined;
      throw error;
    }
  }

  async #releaseClaim(transactionId: string): Promise<void> {
    try {
      await this.stripeTransactionRepository.updateById(transactionId, { status: "failed" });
    } catch (error) {
      this.loggerService.error({ event: "COUPON_CLAIM_RELEASE_FAILED", transactionId, error });
    }
  }

  private async redeemCouponOrPromotionCode({
    payer,
    couponOrPromotion,
    coupon,
    updateField,
    updateId
  }: {
    payer: Payer;
    couponOrPromotion: Stripe.Coupon | Stripe.PromotionCode;
    coupon: Stripe.Coupon;
    updateField: "promotion_code" | "coupon";
    updateId: string;
  }): Promise<{
    coupon: Stripe.Coupon | Stripe.PromotionCode;
    amountAdded: number;
    transactionId: string;
    transactionStatus: StripeTransactionOutput["status"];
  }> {
    this.loggerService.info({
      event: "APPLYING_COUPON",
      couponId: coupon.id,
      valid: coupon.valid,
      redeem_by: coupon.redeem_by,
      max_redemptions: coupon.max_redemptions,
      times_redeemed: coupon.times_redeemed,
      updateField,
      updateId
    });

    if (!coupon.valid) {
      throw new Error(updateField === "promotion_code" ? "Promotion code is invalid or expired" : "Coupon is invalid or expired");
    }

    if (coupon.percent_off) {
      throw new Error("Percentage-based coupons are not supported. Only fixed amount coupons are allowed.");
    }

    if (!coupon.amount_off) {
      throw new Error("Invalid coupon type. Only fixed amount coupons are supported.");
    }

    const amountToAdd = coupon.amount_off; // amount_off is already in cents

    const transaction = await this.#claimCoupon(payer, {
      amount: amountToAdd,
      currency: coupon.currency ?? "usd",
      couponId: coupon.id,
      promotionCodeId: updateField === "promotion_code" ? updateId : undefined,
      description: `Coupon: ${coupon.name || coupon.id}`
    });

    let invoice: Stripe.Invoice | undefined;

    try {
      const stripeCustomerId = await this.customerService.getStripeCustomerId(payer);

      invoice = await this.stripe.invoices.create({
        customer: stripeCustomerId,
        auto_advance: false,
        ...(updateField === "promotion_code" ? { discounts: [{ promotion_code: updateId }] } : { discounts: [{ coupon: updateId }] })
      });

      await this.stripeTransactionRepository.updateById(transaction.id, { stripeInvoiceId: invoice.id });

      this.loggerService.info({
        event: "INVOICE_CREATED_WITH_DISCOUNT",
        userId: payer.user.id,
        invoiceId: invoice.id,
        discountType: updateField
      });

      await this.stripe.invoiceItems.create({
        amount: amountToAdd,
        customer: stripeCustomerId,
        invoice: invoice.id,
        currency: "usd",
        description: "Akash Network Console"
      });

      invoice = await this.stripe.invoices.finalizeInvoice(invoice.id);

      this.loggerService.info({
        event: "INVOICE_FINALIZED_AND_PAID",
        userId: payer.user.id,
        invoiceId: invoice.id,
        status: invoice.status,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid
      });

      return { coupon: couponOrPromotion, amountAdded: amountToAdd / 100, transactionId: transaction.id, transactionStatus: transaction.status };
    } catch (error) {
      let isInvoiceRolledBack: boolean | undefined;

      if (invoice?.id) {
        isInvoiceRolledBack = await this.#cancelUnpaidInvoice(invoice.id).catch(() => false);
      }

      this.loggerService.error({
        event: "COUPON_APPLICATION_FAILED",
        userId: payer.user.id,
        couponId: updateId,
        error,
        isInvoiceRolledBack
      });

      if (!invoice?.id || isInvoiceRolledBack) {
        await this.#releaseClaim(transaction.id);
      }

      throw error;
    }
  }
}

function isStaleWithInvoice(claim: CouponClaimHold): claim is CouponClaimHold & { stripeInvoiceId: string } {
  return claim.status === "pending" && claim.isStale && !!claim.stripeInvoiceId;
}
