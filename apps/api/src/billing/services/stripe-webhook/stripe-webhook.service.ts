import { LoggerService } from "@akashnetwork/logging";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { CheckoutSessionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { WithTransaction } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { BillingConfigService } from "../billing-config/billing-config.service";

@singleton()
export class StripeWebhookService {
  private readonly logger = LoggerService.forContext(StripeWebhookService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly checkoutSessionRepository: CheckoutSessionRepository,
    private readonly refillService: RefillService,
    private readonly billingConfig: BillingConfigService,
    private readonly userRepository: UserRepository
  ) {}

  async routeStripeEvent(signature: string, rawEvent: string) {
    const event = this.stripe.webhooks.constructEvent(rawEvent, signature, this.billingConfig.get("STRIPE_WEBHOOK_SECRET"));
    this.logger.info({ event: "STRIPE_EVENT_RECEIVED", type: event.type });

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await this.tryToTopUpWalletForCheckout(event);
    } else if (event.type === "payment_intent.succeeded") {
      await this.tryToTopUpWalletFromPaymentIntent(event);
    }
  }

  @WithTransaction()
  async tryToTopUpWalletForCheckout(event: Stripe.CheckoutSessionCompletedEvent | Stripe.CheckoutSessionAsyncPaymentSucceededEvent) {
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

  @WithTransaction()
  async tryToTopUpWalletFromPaymentIntent(event: Stripe.PaymentIntentSucceededEvent) {
    const paymentIntent = event.data.object;
    const customerId = paymentIntent.customer as string;

    if (!customerId) {
      this.logger.error({
        event: "PAYMENT_INTENT_MISSING_CUSTOMER_ID",
        paymentIntentId: paymentIntent.id
      });
      return;
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
    if (!user) {
      this.logger.error({
        event: "USER_NOT_FOUND",
        customerId,
        paymentIntentId: paymentIntent.id
      });
      return;
    }

    // Get discount information from metadata
    const metadata = paymentIntent.metadata;
    const originalAmount = metadata?.original_amount ? parseFloat(metadata.original_amount) : paymentIntent.amount;
    const discountApplied = metadata?.discount_applied === "true";

    // If a discount was applied, consume the promotion code
    if (discountApplied) {
      const { discounts } = await this.stripe.getCustomerDiscounts(customerId);
      if (discounts.length > 0) {
        const discount = discounts[0]; // Only one discount can be active at a time
        if (discount.valid) {
          try {
            // Remove the active discount based on its type
            await this.stripe.customers.update(customerId, {
              [discount.type === "promotion_code" ? "promotion_code" : "coupon"]: null
            });

            this.logger.info({
              event: "DISCOUNT_CONSUMED",
              customerId,
              discountId: discount.id,
              discountType: discount.type,
              originalAmount,
              finalAmount: paymentIntent.amount
            });
          } catch (error) {
            this.logger.error({
              event: "FAILED_TO_CONSUME_DISCOUNT",
              customerId,
              discountType: discount.type,
              error
            });
          }
        }
      }
    }

    // Use the original amount for the wallet top-up
    await this.refillService.topUpWallet(originalAmount, user.id);
  }
}
