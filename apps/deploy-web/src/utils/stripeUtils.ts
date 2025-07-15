import { loadStripe, type Stripe } from "@stripe/stripe-js";

import { browserEnvConfig } from "@src/config/browser-env.config";

export function getStripe(): Promise<Stripe | null> {
  const publishableKey = browserEnvConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    console.warn("Stripe publishable key is not configured");
    return Promise.resolve(null);
  }
  return loadStripe(publishableKey);
}
