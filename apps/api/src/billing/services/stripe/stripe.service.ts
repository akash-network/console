import assert from "http-assert";
import orderBy from "lodash/orderBy";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { UserRepository } from "@src/user/repositories/user/user.repository";

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

  async createPaymentIntent(params: {
    customer: string;
    payment_method: string;
    amount: number;
    currency: string;
    confirm: boolean;
    coupon?: string;
    metadata?: Record<string, string>;
  }): Promise<{ success: boolean; paymentIntentId?: string }> {
    // If a coupon is provided, apply it to the customer first
    if (params.coupon) {
      await this.applyCoupon(params.customer, params.coupon);
    }

    // Get customer's current discounts
    const { discounts } = await this.getCustomerDiscounts(params.customer);
    let finalAmount = params.amount;
    let discountApplied = false;

    // Apply any active discounts
    if (discounts.length > 0) {
      const activeDiscount = discounts[0]; // Take the first active discount
      if (activeDiscount.valid) {
        discountApplied = true;
        if (activeDiscount.percent_off) {
          finalAmount = params.amount * (1 - activeDiscount.percent_off / 100);
        } else if (activeDiscount.amount_off) {
          finalAmount = Math.max(0, params.amount - activeDiscount.amount_off / 100);
        }
      }
    }

    // If the final amount is 0 (fully covered by discount), directly top up the wallet
    if (finalAmount === 0) {
      // Get the user ID from the customer ID
      const user = await this.userRepository.findOneBy({ stripeCustomerId: params.customer });
      if (!user) {
        throw new Error("User not found for customer ID");
      }

      // If a discount was applied, consume it
      if (discountApplied) {
        await this.consumeActiveDiscount(params.customer);
      }

      // Top up the wallet with the original amount
      await this.refillService.topUpWallet(params.amount * 100, user.id);

      return { success: true, paymentIntentId: "pi_zero_amount" };
    }

    // For non-zero amounts, proceed with normal payment intent creation
    const metadata = {
      ...params.metadata,
      original_amount: (params.amount * 100).toString(),
      final_amount: (finalAmount * 100).toString(),
      discount_applied: discountApplied.toString()
    };

    const paymentIntent = await this.paymentIntents.create({
      customer: params.customer,
      payment_method: params.payment_method,
      amount: Math.round(finalAmount * 100),
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
    try {
      // First try to find a matching promotion code
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
    } catch (error) {
      console.log("DEBUG:", error);
      throw error;
    }
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

  async getCustomerDiscounts(customerId: string) {
    const customer = (await this.customers.retrieve(customerId, {
      expand: ["discount.coupon", "discount.promotion_code"]
    })) as Stripe.Customer & {
      discount?: {
        coupon?: Stripe.Coupon;
        promotion_code?: Stripe.PromotionCode & {
          coupon: Stripe.Coupon;
        };
      };
    };

    const discounts = [];

    if (customer.discount?.coupon) {
      discounts.push({
        type: "coupon",
        id: customer.discount.coupon.id,
        name: customer.discount.coupon.name,
        percent_off: customer.discount.coupon.percent_off,
        amount_off: customer.discount.coupon.amount_off,
        currency: customer.discount.coupon.currency,
        valid: customer.discount.coupon.valid
      });
    }

    if (customer.discount?.promotion_code) {
      discounts.push({
        type: "promotion_code",
        id: customer.discount.promotion_code.id,
        code: customer.discount.promotion_code.code,
        coupon: {
          id: customer.discount.promotion_code.coupon.id,
          name: customer.discount.promotion_code.coupon.name,
          percent_off: customer.discount.promotion_code.coupon.percent_off,
          amount_off: customer.discount.promotion_code.coupon.amount_off,
          currency: customer.discount.promotion_code.coupon.currency,
          valid: customer.discount.promotion_code.coupon.valid
        }
      });
    }

    return { discounts };
  }

  async consumeActiveDiscount(customerId: string): Promise<boolean> {
    const { discounts } = await this.getCustomerDiscounts(customerId);
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
}
