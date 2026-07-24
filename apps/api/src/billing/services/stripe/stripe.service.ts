import type { LoggerService } from "@akashnetwork/logging";
import assert from "http-assert";
import orderBy from "lodash/orderBy";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";

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

/**
 * Namespace prefix the confirm-payment controller adds to client attempt keys so top-up
 * idempotency keys never collide with other flows'. Whether a reused key tolerates a changed
 * amount is an explicit policy the caller passes to StripeTransactionService, not something
 * inferred from this prefix.
 */
export const TOP_UP_IDEMPOTENCY_KEY_PREFIX = "topup_";

@singleton()
export class StripeService {
  readonly isProduction = this.billingConfig.get("STRIPE_SECRET_KEY").startsWith("sk_live");

  private readonly loggerService: LoggerService;

  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly userRepository: UserRepository,
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: StripeService.name });
  }

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

  async getStripeCustomerId(user: UserOutput): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Stripe idempotency keyed on the user id so concurrent provisioning (eager registration +
    // lazy billing paths) can never create duplicate/orphaned customers before the DB update wins.
    const customer = await this.stripe.customers.create(
      {
        email: user.email ?? undefined,
        name: user.username ?? undefined,
        metadata: {
          userId: user.id
        }
      },
      { idempotencyKey: `create-customer:${user.id}` }
    );

    const updated = await this.userRepository.updateBy({ id: user.id, stripeCustomerId: null }, { stripeCustomerId: customer.id }, { returning: true });

    if (updated) {
      return updated.stripeCustomerId!;
    }

    // Concurrent creation detected: fetch and return the persisted customer ID
    const reloaded = await this.userRepository.findOneBy({ id: user.id });
    assert(reloaded?.stripeCustomerId, 500, "Failed to retrieve stripeCustomerId");
    return reloaded.stripeCustomerId;
  }

  async updateCustomerOrganization(customerId: string, organization: string): Promise<void> {
    const customer = await this.stripe.customers.retrieve(customerId);

    assert(!("deleted" in customer), 404, "Customer is deleted");

    await this.stripe.customers.update(customerId, {
      business_name: organization
    });
  }
}
