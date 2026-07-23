import type { LoggerService } from "@akashnetwork/logging";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { StripeTransactionOutput } from "@src/billing/repositories";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { UserOutput } from "@src/user/repositories/user/user.repository";

@singleton()
export class CouponRedemptionService {
  private readonly loggerService: LoggerService;

  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly stripeService: StripeService,
    private readonly stripeTransactionService: StripeTransactionService,
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
    currentUser: UserOutput,
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
        currentUser,
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
        currentUser,
        couponOrPromotion: matchingCoupon,
        coupon: matchingCoupon,
        updateField: "coupon",
        updateId: matchingCoupon.id
      });
    }

    throw new Error("No valid promotion code or coupon found with the provided code");
  }

  private async redeemCouponOrPromotionCode({
    currentUser,
    couponOrPromotion,
    coupon,
    updateField,
    updateId
  }: {
    currentUser: UserOutput;
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

    // Ensure the user has a Stripe customer only once the coupon is known to be redeemable. Brand-new
    // accounts may not have one yet since it is created lazily by the add-payment-method flow (see
    // getStripeCustomerId); provisioning it earlier would create customers for invalid/unsupported coupons.
    const stripeCustomerId = await this.stripeService.getStripeCustomerId(currentUser);

    let invoice: Stripe.Invoice | undefined;

    try {
      invoice = await this.stripe.invoices.create({
        customer: stripeCustomerId,
        auto_advance: false,
        ...(updateField === "promotion_code" ? { discounts: [{ promotion_code: updateId }] } : { discounts: [{ coupon: updateId }] })
      });

      this.loggerService.info({
        event: "INVOICE_CREATED_WITH_DISCOUNT",
        userId: currentUser.id,
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

      const transaction = await this.stripeTransactionService.recordCouponClaim({
        userId: currentUser.id,
        amount: amountToAdd,
        currency: coupon.currency ?? "usd",
        couponId: coupon.id,
        promotionCodeId: updateField === "promotion_code" ? updateId : undefined,
        invoiceId: invoice.id,
        description: `Coupon: ${coupon.name || coupon.id}`
      });

      invoice = await this.stripe.invoices.finalizeInvoice(invoice.id);

      this.loggerService.info({
        event: "INVOICE_FINALIZED_AND_PAID",
        userId: currentUser.id,
        invoiceId: invoice.id,
        status: invoice.status,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid
      });

      return { coupon: couponOrPromotion, amountAdded: amountToAdd / 100, transactionId: transaction.id, transactionStatus: transaction.status };
    } catch (error) {
      let isInvoiceRolledBack: boolean | undefined;

      if (invoice?.id) {
        isInvoiceRolledBack = await this.stripe.invoices
          .voidInvoice(invoice.id)
          .then(() => true)
          .catch(() => false);
      }

      this.loggerService.error({
        event: "COUPON_APPLICATION_FAILED",
        userId: currentUser.id,
        couponId: updateId,
        error,
        isInvoiceRolledBack
      });

      throw error;
    }
  }
}
