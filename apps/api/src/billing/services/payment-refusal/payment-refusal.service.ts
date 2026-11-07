import createError from "http-errors";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { AUTO_RECHARGE_METADATA_KEY } from "@src/billing/services/stripe-transaction/stripe-transaction.service";

/** Kept equal to the Add credits form, so a refusal counts the same whichever tab or browser the customer pays from. */
export const MAX_REFUSALS_PER_WINDOW = 5;

export const REFUSAL_WINDOW_MS = 30 * 60 * 1000;

export const REFUSALS_PER_PAYMENT_METHOD = 2;

export const PAYMENT_METHOD_REFUSED_ERROR_CODE = "payment_method_refused";

export const PAYMENTS_PAUSED_ERROR_CODE = "payments_paused";

const MAX_LISTED_PAYMENT_INTENTS = 100;

const PAYMENT_AUTHENTICATION_FAILURE_CODE = "payment_intent_authentication_failure";

const MS_PER_SECOND = 1000;

export interface PaymentRefusals {
  refusedPaymentMethodIds: string[];
  pausedUntil: Date | null;
}

interface Refusal {
  paymentMethodId?: string;
  refusedAt: number;
}

/** Reads the customer's recent payments from Stripe, so refusals are remembered across tabs and devices without a table of our own. */
@singleton()
export class PaymentRefusalService {
  constructor(@inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}

  async findRecentRefusals(customerId: string): Promise<PaymentRefusals> {
    const now = Date.now();
    const refusals = await this.#listRefusalsSinceLastPayment(customerId, now);

    return {
      refusedPaymentMethodIds: findRefusedPaymentMethodIds(refusals),
      pausedUntil: findPauseEnd(refusals)
    };
  }

  async assertMayCharge(customerId: string, paymentMethodId: string): Promise<void> {
    const { refusedPaymentMethodIds, pausedUntil } = await this.findRecentRefusals(customerId);

    if (pausedUntil) {
      throw createError(429, "Too many payments were refused in a short time. Please try again later.", {
        errorCode: PAYMENTS_PAUSED_ERROR_CODE,
        errorType: "payment_error",
        headers: { "Retry-After": String(Math.ceil((pausedUntil.getTime() - Date.now()) / MS_PER_SECOND)) }
      });
    }

    if (refusedPaymentMethodIds.includes(paymentMethodId)) {
      throw createError(402, "Your bank refused this payment method. Try a different card or payment method.", {
        errorCode: PAYMENT_METHOD_REFUSED_ERROR_CODE,
        errorType: "payment_error"
      });
    }
  }

  async #listRefusalsSinceLastPayment(customerId: string, now: number): Promise<Refusal[]> {
    const { data } = await this.stripe.paymentIntents.list({
      customer: customerId,
      created: { gt: Math.floor((now - REFUSAL_WINDOW_MS) / MS_PER_SECOND) },
      limit: MAX_LISTED_PAYMENT_INTENTS
    });
    const paymentIntents = data.filter(paymentIntent => paymentIntent.metadata?.[AUTO_RECHARGE_METADATA_KEY] !== "true");
    const lastPaidAt = Math.max(0, ...paymentIntents.filter(paymentIntent => paymentIntent.status === "succeeded").map(paymentIntent => paymentIntent.created));

    return paymentIntents
      .filter(
        paymentIntent =>
          paymentIntent.status !== "succeeded" && isRefusedByPaymentMethod(paymentIntent.last_payment_error) && paymentIntent.created > lastPaidAt
      )
      .map(paymentIntent => ({ paymentMethodId: refusedPaymentMethodIdOf(paymentIntent), refusedAt: paymentIntent.created * MS_PER_SECOND }));
  }
}

/** Matches the Add credits form: only the card or its 3D Secure check refusing counts, not a processing or request error. */
function isRefusedByPaymentMethod(error: Stripe.PaymentIntent.LastPaymentError | null): boolean {
  return error?.type === "card_error" || error?.code === PAYMENT_AUTHENTICATION_FAILURE_CODE;
}

function refusedPaymentMethodIdOf(paymentIntent: Stripe.PaymentIntent): string | undefined {
  const paymentMethod = paymentIntent.last_payment_error?.payment_method ?? paymentIntent.payment_method;
  return typeof paymentMethod === "string" ? paymentMethod : paymentMethod?.id;
}

function findRefusedPaymentMethodIds(refusals: Refusal[]): string[] {
  const refusalCounts = new Map<string, number>();

  for (const { paymentMethodId } of refusals) {
    if (paymentMethodId) refusalCounts.set(paymentMethodId, (refusalCounts.get(paymentMethodId) ?? 0) + 1);
  }

  return [...refusalCounts].filter(([, count]) => count >= REFUSALS_PER_PAYMENT_METHOD).map(([paymentMethodId]) => paymentMethodId);
}

function findPauseEnd(refusals: Refusal[]): Date | null {
  if (refusals.length < MAX_REFUSALS_PER_WINDOW) return null;
  const refusalTimes = refusals.map(refusal => refusal.refusedAt).sort((a, b) => a - b);
  return new Date(refusalTimes[refusalTimes.length - MAX_REFUSALS_PER_WINDOW] + REFUSAL_WINDOW_MS);
}
