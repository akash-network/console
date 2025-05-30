import assert from "http-assert";
import orderBy from "lodash/orderBy";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

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
  constructor(private readonly billingConfig: BillingConfigService) {
    super(billingConfig.get("STRIPE_SECRET_KEY"), {
      apiVersion: "2024-06-20"
    });
  }

  async createSetupIntent(customerId: string) {
    return await this.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
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

  async createPaymentIntent(params: { customer: string; payment_method: string; amount: number; currency: string; confirm: boolean; coupon?: string }) {
    // Coupon is not directly supported on PaymentIntent; you may need to handle discounts separately.
    return await this.paymentIntents.create({
      customer: params.customer,
      payment_method: params.payment_method,
      amount: params.amount,
      currency: params.currency,
      confirm: params.confirm
      // If you want to handle coupon/discount, you must do so via invoice or subscription, not PaymentIntent.
    });
  }

  async applyCoupon(customerId: string, couponId: string) {
    const coupon = await this.coupons.retrieve(couponId);
    if (!coupon.valid) {
      throw new Error("Coupon is invalid or expired");
    }
    await this.customers.update(customerId, {
      coupon: couponId
    });
    return coupon;
  }
}
