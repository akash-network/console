import Stripe from "stripe";
import { singleton } from "tsyringe";

import { CheckoutSessionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";

@singleton()
export class StripeWebhookService {
  constructor(
    private readonly stripe: StripeService,
    private readonly checkoutSessionRepository: CheckoutSessionRepository,
    private readonly refillService: RefillService
  ) {}

  async routeStripeEvent(signature: string, rawEvent: string) {
    const event = this.stripe.webhooks.constructEvent(rawEvent, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await this.tryToTopUpWallet(event);
    }
  }

  async tryToTopUpWallet(event: Stripe.CheckoutSessionCompletedEvent | Stripe.CheckoutSessionAsyncPaymentSucceededEvent) {
    const checkoutSessionCache = await this.checkoutSessionRepository.findOneBy({ sessionId: event.data.object.id });

    if (!checkoutSessionCache) {
      return;
    }

    const checkoutSession = await this.stripe.checkout.sessions.retrieve(event.data.object.id, {
      expand: ["line_items"]
    });

    if (checkoutSession.payment_status !== "unpaid") {
      await this.refillService.topUpWallet(checkoutSession.amount_total, checkoutSessionCache.userId);
      await this.checkoutSessionRepository.deleteBy({ sessionId: event.data.object.id });
    }
  }
}
