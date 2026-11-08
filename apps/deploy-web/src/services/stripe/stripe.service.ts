import { loadStripe, type Stripe, type StripeConstructorOptions } from "@stripe/stripe-js";

/** Stripe's sandbox assistant floats over the bottom right of test-mode pages, where it takes clicks meant for the Add Credits sheet. */
const STRIPE_OPTIONS: StripeConstructorOptions = { developerTools: { assistant: { enabled: false } } };

export interface StripeServiceDependencies {
  loadStripe?: typeof loadStripe;
  config: {
    publishableKey: string;
  };
}

export type StripeLoadFailure = "unconfigured" | "script_failed";

export type StripeLoadResult = { stripe: Stripe; failure?: undefined } | { stripe: null; failure: StripeLoadFailure };

export class StripeService {
  #loading: Promise<StripeLoadResult> | null = null;
  private dependencies: Required<StripeServiceDependencies>;

  constructor(dependencies: StripeServiceDependencies) {
    this.dependencies = {
      loadStripe,
      ...dependencies
    };
  }

  async getStripe(): Promise<Stripe | null> {
    return (await this.load()).stripe;
  }

  /** Every caller shares one in-flight load, so the page creates a single Stripe instance, and a failed load is attempted again on the next call. */
  load(): Promise<StripeLoadResult> {
    if (!this.#loading) {
      const loading = this.#loadStripe();
      this.#loading = loading;
      void loading.then(result => {
        if (result.failure && this.#loading === loading) this.#loading = null;
      });
    }
    return this.#loading;
  }

  async #loadStripe(): Promise<StripeLoadResult> {
    const publishableKey = this.dependencies.config.publishableKey;
    if (!publishableKey) {
      console.warn("Stripe publishable key is not configured");
      return { stripe: null, failure: "unconfigured" };
    }

    try {
      const stripe = await this.dependencies.loadStripe(publishableKey, STRIPE_OPTIONS);
      if (stripe) return { stripe };
    } catch (error) {
      console.error("Failed to load Stripe:", error);
    }
    return { stripe: null, failure: "script_failed" };
  }

  clearStripeInstance(): void {
    this.#loading = null;
  }
}
