import Stripe from "stripe";

export const CARD_DECLINED_ERROR_CODE = "card_declined";

/** Codes the issuer will never approve on a retry, and reattempting them is exactly what card networks penalise. */
const TERMINAL_DECLINE_CODES: ReadonlySet<string> = new Set([
  "lost_card",
  "stolen_card",
  "fraudulent",
  "pickup_card",
  "revocation_of_all_authorizations",
  "stop_payment_order",
  "merchant_blacklist"
]);

export type CardDecline = {
  declineCode?: string;
  isTerminal: boolean;
};

/**
 * Recognises the shapes a declined charge arrives in, so that only the card is held against the
 * wallet: a Stripe outage or a bug of ours must never count towards pausing auto top-up.
 */
export function toCardDecline(error: unknown): CardDecline | undefined {
  if (error instanceof Stripe.errors.StripeCardError) {
    return describeDecline(error.decline_code);
  }

  if (isCardDeclinedError(error)) {
    return describeDecline(error.declineCode);
  }

  return undefined;
}

function isCardDeclinedError(error: unknown): error is { errorCode: string; declineCode?: string } {
  return typeof error === "object" && error !== null && (error as { errorCode?: unknown }).errorCode === CARD_DECLINED_ERROR_CODE;
}

function describeDecline(declineCode: string | undefined): CardDecline {
  return {
    ...(declineCode && { declineCode }),
    isTerminal: !!declineCode && TERMINAL_DECLINE_CODES.has(declineCode)
  };
}
