import type { Context } from "hono";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { CheckoutService } from "@src/billing/services/checkout/checkout.service";
import { StripeWebhookService } from "@src/billing/services/stripe-webhook/stripe-webhook.service";

@singleton()
export class CheckoutController {
  constructor(
    private readonly authService: AuthService,
    private readonly checkoutService: CheckoutService,
    private readonly stripeWebhookService: StripeWebhookService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig
  ) {}

  async checkout(c: Context) {
    const { currentUser } = this.authService;
    const redirectUrl = this.billingConfig.STRIPE_CHECKOUT_REDIRECT_URL;

    if (!currentUser?.userId) {
      return c.redirect(`${redirectUrl}?unauthorized=true`);
    }

    const session = await this.checkoutService.checkoutFor(currentUser, redirectUrl);

    return c.redirect(session.url);
  }

  async webhook(signature: string, input: string) {
    await this.stripeWebhookService.routeStripeEvent(signature, input);
  }
}
