import orderBy from "lodash/orderBy";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

interface StripePrices {
  unitAmount: number;
  isCustom: boolean;
  currency: string;
}

/**
 * We only support USD for Stripe payments. Hardcoding the currency at every charge-creation
 * chokepoint guarantees no caller can ever create a non-USD charge.
 */
export const STRIPE_CURRENCY = "usd";

@singleton()
export class StripeService {
  readonly isProduction = this.billingConfig.get("STRIPE_SECRET_KEY").startsWith("sk_live");

  constructor(
    private readonly billingConfig: BillingConfigService,
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe
  ) {}

  async createSetupIntent(customerId: string, { isFreeTrial }: { isFreeTrial: boolean }) {
    return await this.stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card", "link"],
      ...(isFreeTrial && { metadata: { is_free_trial: "true" } })
    });
  }

  retrievePaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.retrieve(paymentMethodId);
  }

  detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
    return this.stripe.charges.retrieve(chargeId);
  }

  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.billingConfig.get("STRIPE_WEBHOOK_SECRET"));
  }

  async findPrices(): Promise<StripePrices[]> {
    const { data: prices } = await this.stripe.prices.list({ active: true, product: this.billingConfig.get("STRIPE_PRODUCT_ID") });
    const responsePrices = prices.map(price => ({
      unitAmount: price.custom_unit_amount || !price.unit_amount ? undefined : price.unit_amount / 100,
      isCustom: !!price.custom_unit_amount,
      currency: price.currency
    }));

    return orderBy(responsePrices, ["isCustom", "unitAmount"], ["asc", "asc"]) as StripePrices[];
  }

  async listPromotionCodes() {
    const promotionCodes = await this.stripe.promotionCodes.list({
      expand: ["data.promotion.coupon"]
    });
    return { promotionCodes: promotionCodes.data };
  }

  async getCoupon(couponId: string) {
    return await this.stripe.coupons.retrieve(couponId);
  }
}
