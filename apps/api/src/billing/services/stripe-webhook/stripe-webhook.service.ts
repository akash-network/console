import { LoggerService } from "@akashnetwork/logging";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { CheckoutSessionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { WithTransaction } from "@src/core";
import { BillingConfigService } from "../billing-config/billing-config.service";

@singleton()
export class StripeWebhookService {
  private readonly logger = LoggerService.forContext(StripeWebhookService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly checkoutSessionRepository: CheckoutSessionRepository,
    private readonly refillService: RefillService,
    private readonly billingConfig: BillingConfigService
  ) {}

  async routeStripeEvent(signature: string, rawEvent: string) {
    const event = this.stripe.webhooks.constructEvent(rawEvent, signature, this.billingConfig.get("STRIPE_WEBHOOK_SECRET"));
    this.logger.info({ event: "STRIPE_EVENT_RECEIVED", type: event.type });

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await this.tryToTopUpWallet(event);
    }
  }

  @WithTransaction()
  async tryToTopUpWallet(event: Stripe.CheckoutSessionCompletedEvent | Stripe.CheckoutSessionAsyncPaymentSucceededEvent) {
    const sessionId = event.data.object.id;
    const checkoutSessionCache = await this.checkoutSessionRepository.findOneByAndLock({ sessionId });

    if (!checkoutSessionCache) {
      this.logger.info({ event: "SESSION_NOT_FOUND", sessionId });
      return;
    }

    const checkoutSession = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"]
    });

    if (checkoutSession.payment_status !== "unpaid") {
      await this.refillService.topUpWallet(checkoutSession.amount_subtotal!, checkoutSessionCache.userId);
      await this.checkoutSessionRepository.deleteBy({ sessionId });
    } else {
      this.logger.error({ event: "PAYMENT_NOT_COMPLETED", sessionId });
    }
  }
}
