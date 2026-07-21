import Stripe from "stripe";
import type { InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

export const STRIPE_CLIENT: InjectionToken<Stripe> = Symbol("STRIPE_CLIENT");

container.register(STRIPE_CLIENT, {
  useFactory: instancePerContainerCachingFactory(
    c =>
      new Stripe(c.resolve(BillingConfigService).get("STRIPE_SECRET_KEY"), {
        apiVersion: "2025-10-29.clover",
        httpClient: Stripe.createFetchHttpClient()
      })
  )
});

export const InjectStripeClient = () => inject(STRIPE_CLIENT);
