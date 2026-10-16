import { loadStripe, type Stripe, type StripeConstructorOptions } from "@stripe/stripe-js";

/** Stripe's sandbox assistant floats over the bottom right of test-mode pages, where it takes clicks meant for the Add Credits sheet. */
const STRIPE_OPTIONS: StripeConstructorOptions = { developerTools: { assistant: { enabled: false } } };

export interface StripeServiceDependencies {
  loadStripe?: typeof loadStripe;
  config: {
    publishableKey: string;
  };
}

export class StripeService {
  private stripeInstance: Stripe | null = null;
  private dependencies: Required<StripeServiceDependencies>;

  constructor(dependencies: StripeServiceDependencies) {
    this.dependencies = {
      loadStripe,
      ...dependencies
    };
  }

  async getStripe(): Promise<Stripe | null> {
    if (this.stripeInstance) {
      return this.stripeInstance;
    }

    const publishableKey = this.dependencies.config.publishableKey;
    if (!publishableKey) {
      console.warn("Stripe publishable key is not configured");
      return null;
    }

    try {
      this.stripeInstance = await this.dependencies.loadStripe(publishableKey, STRIPE_OPTIONS);
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
