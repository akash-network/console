import assert from "http-assert";
import orderBy from "lodash/orderBy";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { Discount } from "@src/billing/http-schemas/stripe.schema";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";

interface CheckoutOptions {
  customerId: string;
  redirectUrl: string;
  amount?: string;
}

interface StripePrices {
  unitAmount: number;
  isCustom: boolean;
  currency: string;
}

@singleton()
export class StripeService extends Stripe {
  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly userRepository: UserRepository,
    private readonly refillService: RefillService
  ) {
    super(billingConfig.get("STRIPE_SECRET_KEY"), {
      apiVersion: "2024-06-20"
    });
  }

  async createSetupIntent(customerId: string) {
    return await this.setupIntents.create({
      customer: customerId,
      usage: "off_session"
    });
  }

  async startCheckoutSession(options: CheckoutOptions) {
    const price = await this.getPrice(options.amount);

    return await this.checkout.sessions.create({
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      mode: "payment",
      allow_promotion_codes: !!options.amount,
      customer: options.customerId,
      success_url: `${options.redirectUrl}?session_id={CHECKOUT_SESSION_ID}&payment-success=true`,
      cancel_url: `${options.redirectUrl}?session_id={CHECKOUT_SESSION_ID}&payment-canceled=true`
    });
  }

  private async getPrice(amount?: string) {
    const { data: prices } = await this.prices.list({ active: true, product: this.billingConfig.get("STRIPE_PRODUCT_ID") });

    const price = prices.find(price => {
      const isCustom = !amount && !!price.custom_unit_amount;

      if (isCustom) {
        return true;
      }

      return price.unit_amount === Number(amount) * 100;
    });

    assert(price, 400, "Price invalid");

    return price;
  }

  async findPrices(): Promise<StripePrices[]> {
    const { data: prices } = await this.prices.list({ active: true, product: this.billingConfig.get("STRIPE_PRODUCT_ID") });
    const responsePrices = prices.map(price => ({
      unitAmount: price.custom_unit_amount || !price.unit_amount ? undefined : price.unit_amount / 100,
      isCustom: !!price.custom_unit_amount,
      currency: price.currency
    }));

    return orderBy(responsePrices, ["isCustom", "unitAmount"], ["asc", "asc"]) as StripePrices[];
  }

  async getPaymentMethods(customerId: string) {
    const paymentMethods = await this.paymentMethods.list({
      customer: customerId,
      type: "card"
    });
    return paymentMethods.data;
  }

  private calculateDiscountedAmount(amountCents: number, discount: Discount): number {
    if (!discount.valid) {
      return amountCents;
    }

    if (discount.percent_off) {
      // Calculate percentage discount using integer math
      return Math.round((amountCents * (100 - discount.percent_off)) / 100);
    } else if (discount.amount_off) {
      // amount_off is already in cents from Stripe
      return Math.max(0, amountCents - discount.amount_off);
    }

    return amountCents;
  }

  private async handleZeroAmountPayment(
    customerId: string,
    originalAmountCents: number,
    discountApplied: boolean
  ): Promise<{ success: boolean; paymentIntentId: string }> {
    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
    assert(user, 404, "User not found for customer ID");

    if (discountApplied) {
      await this.consumeActiveDiscount(customerId);
    }

    await this.refillService.topUpWallet(originalAmountCents, user.id);

    return { success: true, paymentIntentId: "pi_zero_amount" };
  }

  async createPaymentIntent(params: {
    customer: string;
    payment_method: string;
    amount: number;
    currency: string;
    confirm: boolean;
    coupon?: string;
    metadata?: Record<string, string>;
  }): Promise<{ success: boolean; paymentIntentId?: string }> {
    if (params.coupon) {
      await this.applyCoupon(params.customer, params.coupon);
    }

    const discounts = await this.getCustomerDiscounts(params.customer);
    // Convert amount to cents immediately for stripe
    let finalAmountCents = Math.round(params.amount * 100);
    let discountApplied = false;

    if (discounts.length > 0) {
      // Apply the first active discount
      const activeDiscount = discounts[0];
      if (activeDiscount.valid) {
        discountApplied = true;
        finalAmountCents = this.calculateDiscountedAmount(finalAmountCents, activeDiscount);
      }
    }

    // If the final amount is 0 (fully covered by discount), directly top up the wallet
    if (finalAmountCents === 0) {
      return this.handleZeroAmountPayment(params.customer, Math.round(params.amount * 100), discountApplied);
    }

    // For non-zero amounts, proceed with normal payment intent creation
    const metadata = {
      ...params.metadata,
      original_amount: Math.round(params.amount * 100).toString(),
      final_amount: finalAmountCents.toString(),
      discount_applied: discountApplied.toString()
    };

    const finalAmountDollars = finalAmountCents / 100;
    if (finalAmountDollars > 0 && finalAmountDollars < 1) {
      throw new Error("Final amount after discount must be at least $1");
    } else if (!discounts.length && finalAmountDollars > 0 && finalAmountDollars < 20) {
      throw new Error("Minimum payment amount is $20 (before any discounts)");
    }

    const paymentIntent = await this.paymentIntents.create({
      customer: params.customer,
      payment_method: params.payment_method,
      amount: finalAmountCents,
      currency: params.currency,
      confirm: params.confirm,
      metadata,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never"
      }
    });

    return { success: paymentIntent.status === "succeeded", paymentIntentId: paymentIntent.id };
  }

  async listPromotionCodes() {
    const promotionCodes = await this.promotionCodes.list({
      expand: ["data.coupon"]
    });
    return { promotionCodes: promotionCodes.data };
  }

  async findPromotionCodeByCode(code: string) {
    const { data: promotionCodes } = await this.promotionCodes.list({
      code,
      expand: ["data.coupon"]
    });
    return promotionCodes[0];
  }

  async applyCoupon(customerId: string, couponCode: string) {
    const promotionCode = await this.findPromotionCodeByCode(couponCode);

    if (promotionCode) {
      if (!promotionCode.coupon.valid) {
        throw new Error("Promotion code is invalid or expired");
      }
      await this.customers.update(customerId, {
        promotion_code: promotionCode.id
      });
      return promotionCode;
    }

    // If no promotion code found, try to find a matching coupon
    const { coupons } = await this.listCoupons();
    const matchingCoupon = coupons.find(coupon => coupon.id === couponCode);

    if (matchingCoupon) {
      if (!matchingCoupon.valid) {
        throw new Error("Coupon is invalid or expired");
      }
      await this.customers.update(customerId, {
        coupon: matchingCoupon.id
      });
      return matchingCoupon;
    }

    throw new Error("No valid promotion code or coupon found with the provided code");
  }

  async listCoupons() {
    const coupons = await this.coupons.list({
      limit: 100
    });
    return { coupons: coupons.data };
  }

  async getCoupon(couponId: string) {
    const coupon = await this.coupons.retrieve(couponId);
    return coupon;
  }

  async getCustomerDiscounts(customerId: string): Promise<Discount[]> {
    const customer = (await this.customers.retrieve(customerId, {
      expand: ["discount.coupon", "discount.promotion_code", "discount.promotion_code.coupon"]
    })) as Stripe.Customer & {
      discount?: {
        coupon?: Stripe.Coupon;
        promotion_code?: Stripe.PromotionCode & {
          coupon: Stripe.Coupon;
        };
      };
    };

    const discounts = [];

    if (customer.discount?.promotion_code) {
      discounts.push({
        type: "promotion_code" as const,
        id: customer.discount.promotion_code.id,
        coupon_id: customer.discount.promotion_code.coupon.id,
        code: customer.discount.promotion_code.code,
        name: customer.discount.promotion_code.coupon.name,
        percent_off: customer.discount.promotion_code.coupon.percent_off,
        amount_off: customer.discount.promotion_code.coupon.amount_off,
        currency: customer.discount.promotion_code.coupon.currency,
        valid: customer.discount.promotion_code.coupon.valid
      });
    }

    // Filter out invalid discounts
    const validDiscounts = discounts.filter(discount => discount.valid);

    return validDiscounts;
  }

  async consumeActiveDiscount(customerId: string): Promise<boolean> {
    const discounts = await this.getCustomerDiscounts(customerId);
    if (discounts.length > 0) {
      const discount = discounts[0];
      if (discount.valid) {
        // Remove the active discount based on its type
        await this.customers.update(customerId, {
          [discount.type === "promotion_code" ? "promotion_code" : "coupon"]: null
        });
        return true;
      }
    }
    return false;
  }

  async getCustomerTransactions(customerId: string, options?: { limit?: number; startingAfter?: string }) {
    const charges = await this.charges.list({
      customer: customerId,
      limit: options?.limit ?? 100,
      starting_after: options?.startingAfter,
      expand: ["data.payment_intent"]
    });

    const transactions = charges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      created: charge.created,
      paymentMethod: charge.payment_method_details,
      receiptUrl: charge.receipt_url,
      description: charge.description,
      metadata: charge.metadata
    }));

    return {
      transactions,
      hasMore: charges.has_more,
      nextPage: charges.data[charges.data.length - 1]?.id
    };
  }

  async getStripeCustomerId(user: UserOutput): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.customers.create({
      email: user.email ?? undefined,
      name: user.username ?? undefined,
      metadata: {
        userId: user.userId
      }
    });

    await this.userRepository.updateById(user.id, {
      stripeCustomerId: customer.id
    });

    return customer.id;
  }
}
