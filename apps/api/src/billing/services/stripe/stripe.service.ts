import Stripe from "stripe";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";

interface CheckoutOptions {
  customerId: string;
  redirectUrl: string;
}

@singleton()
export class StripeService extends Stripe {
  constructor(@InjectBillingConfig() private readonly billingConfig: BillingConfig) {
    super(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20"
    });
  }

  async startCheckoutSession(options: CheckoutOptions) {
    return await this.checkout.sessions.create({
      line_items: [
        {
          price: this.billingConfig.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      mode: "payment",
      customer: options.customerId,
      success_url: `${options.redirectUrl}?session_id={CHECKOUT_SESSION_ID}&payment-success=true`,
      cancel_url: `${options.redirectUrl}?session_id={CHECKOUT_SESSION_ID}&payment-canceled=true`
    });
  }
}
