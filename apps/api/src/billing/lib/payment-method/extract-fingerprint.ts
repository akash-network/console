import crypto from "crypto";
import type Stripe from "stripe";

/**
 * Stable identity used to dedupe a payment method across Stripe objects: the card fingerprint when
 * present, otherwise a hash of the lowercased Link email. Returns undefined when neither identifies
 * the method (e.g. a bank account), in which case the caller must not try to sync it locally.
 */
export function extractFingerprint(paymentMethod: Stripe.PaymentMethod): string | undefined {
  if (paymentMethod.card?.fingerprint) {
    return paymentMethod.card.fingerprint;
  }

  if (paymentMethod.type === "link" && paymentMethod.link?.email) {
    return `link_${crypto.createHash("sha256").update(paymentMethod.link.email.toLowerCase()).digest("hex")}`;
  }
}
