import type { LoggerService } from "@akashnetwork/logging";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { type CouponClaimHold, StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { CustomerService } from "@src/billing/services/customer/customer.service";
import type { Payer } from "@src/billing/services/payer/payer";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { type CreateLogger, LOGGER_FACTORY, TxService } from "@src/core";

interface CouponRedemption {
  amountAdded: number;
  transactionId: string;
  transactionStatus: StripeTransactionOutput["status"];
}

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

  async redeemCoupon(payer: Payer, code: string): Promise<CouponRedemption> {
    const promotionCode = await this.findPromotionCodeByCode(code);

    if (!promotionCode) {
      throw new Error("No valid promotion code or coupon found with the provided code");
    }

    const coupon = promotionCode.promotion.coupon;

    if (typeof coupon === "string" || !coupon) {
      throw new Error("Promotion code coupon was not expanded");
    }

    return this.redeemPromotionCode({ payer, promotionCode, coupon });
  }

  /** Stripe's limits cannot see that a person's payers belong to one person, so a person claims each coupon once whatever the payer. */
  async #claimCoupon(
    payer: Payer,
    claim: { amount: number; currency: string; couponId: string; promotionCodeId: string; description: string }
  ): Promise<StripeTransactionOutput> {
    const lookup = { userId: payer.user.id, couponId: claim.couponId };

    await this.#releaseStaleClaims(await this.stripeTransactionRepository.findCouponClaims(lookup));

    return await this.txService.transaction(async () => {
      await this.stripeTransactionRepository.lockCouponClaims(payer.user.id, claim.couponId);

      if ((await this.stripeTransactionRepository.findCouponClaims(lookup)).length > 0) {
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

  private async redeemPromotionCode({
    payer,
    promotionCode,
    coupon
  }: {
    payer: Payer;
    promotionCode: Stripe.PromotionCode;
    coupon: Stripe.Coupon;
  }): Promise<CouponRedemption> {
    this.loggerService.info({
      event: "APPLYING_COUPON",
      couponId: coupon.id,
      valid: coupon.valid,
      redeem_by: coupon.redeem_by,
      max_redemptions: coupon.max_redemptions,
      times_redeemed: coupon.times_redeemed,
      promotionCodeId: promotionCode.id
    });

    if (!coupon.valid) {
      throw new Error("Promotion code is invalid or expired");
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
      promotionCodeId: promotionCode.id,
      description: `Coupon: ${coupon.name || coupon.id}`
    });

    let invoice: Stripe.Invoice | undefined;

    try {
      const stripeCustomerId = await this.customerService.getStripeCustomerId(payer);

      invoice = await this.stripe.invoices.create({
        customer: stripeCustomerId,
        auto_advance: false,
        discounts: [{ promotion_code: promotionCode.id }]
      });

      await this.stripeTransactionRepository.updateById(transaction.id, { stripeInvoiceId: invoice.id });

      this.loggerService.info({
        event: "INVOICE_CREATED_WITH_DISCOUNT",
        userId: payer.user.id,
        invoiceId: invoice.id
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

      return { amountAdded: amountToAdd / 100, transactionId: transaction.id, transactionStatus: transaction.status };
    } catch (error) {
      let isInvoiceRolledBack: boolean | undefined;

      if (invoice?.id) {
        isInvoiceRolledBack = await this.#cancelUnpaidInvoice(invoice.id).catch(() => false);
      }

      this.loggerService.error({
        event: "COUPON_APPLICATION_FAILED",
        userId: payer.user.id,
        couponId: coupon.id,
        promotionCodeId: promotionCode.id,
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
