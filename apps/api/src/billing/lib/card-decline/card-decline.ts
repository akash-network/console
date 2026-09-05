import Stripe from "stripe";

export const CARD_DECLINED_ERROR_CODE = "card_declined";

/** Stripe's decline code when the issuer demands 3DS on a charge the absent customer cannot authenticate. */
export const AUTHENTICATION_REQUIRED_DECLINE_CODE = "authentication_required";

/** Codes no off-session retry can clear: the issuer will never approve them, or only the absent customer could. */
const TERMINAL_DECLINE_CODES: ReadonlySet<string> = new Set([
  "lost_card",
  "stolen_card",
  "fraudulent",
  "pickup_card",
  "revocation_of_all_authorizations",
  "stop_payment_order",
  "merchant_blacklist",
  AUTHENTICATION_REQUIRED_DECLINE_CODE
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
