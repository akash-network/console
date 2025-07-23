import { loadStripe, type Stripe } from "@stripe/stripe-js";

import { browserEnvConfig } from "@src/config/browser-env.config";

export interface StripeServiceDependencies {
  loadStripe: typeof loadStripe;
  browserEnvConfig: typeof browserEnvConfig;
}

export class StripeService {
  private stripeInstance: Stripe | null = null;
  private dependencies: StripeServiceDependencies;

  constructor(dependencies?: Partial<StripeServiceDependencies>) {
    this.dependencies = {
      loadStripe,
      browserEnvConfig,
      ...dependencies
    };
  }

  async getStripe(): Promise<Stripe | null> {
    if (this.stripeInstance) {
      return this.stripeInstance;
    }

    const publishableKey = this.dependencies.browserEnvConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.warn("Stripe publishable key is not configured");
      return null;
    }

    try {
      this.stripeInstance = await this.dependencies.loadStripe(publishableKey);
      return this.stripeInstance;
    } catch (error) {
      console.error("Failed to load Stripe:", error);
      return null;
    }
  }

  clearStripeInstance(): void {
    this.stripeInstance = null;
  }
}
