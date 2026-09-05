import createError from "http-errors";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { CARD_DECLINED_ERROR_CODE, toCardDecline } from "./card-decline";

describe("toCardDecline", () => {
  it("reads the decline code off a Stripe card error", () => {
    const decline = toCardDecline(cardError("insufficient_funds"));

    expect(decline).toEqual({ declineCode: "insufficient_funds", isTerminal: false });
  });

  it("recognises a decline reported through the payment error shape", () => {
    const error = createError(402, "Your card was declined", { errorCode: CARD_DECLINED_ERROR_CODE, declineCode: "generic_decline" });

    expect(toCardDecline(error)).toEqual({ declineCode: "generic_decline", isTerminal: false });
  });

  it("still counts a decline that arrived without a code", () => {
    expect(toCardDecline(cardError(undefined))).toEqual({ isTerminal: false });
  });

  it.each([
    "lost_card",
    "stolen_card",
    "fraudulent",
    "pickup_card",
    "revocation_of_all_authorizations",
    "stop_payment_order",
    "merchant_blacklist",
    "authentication_required"
  ])("treats %s as terminal", declineCode => {
    expect(toCardDecline(cardError(declineCode))).toEqual({ declineCode, isTerminal: true });
  });

  it("ignores a Stripe outage", () => {
    expect(toCardDecline(new Stripe.errors.StripeAPIError({ type: "api_error", message: "Service unavailable" }))).toBeUndefined();
  });

  it("ignores an error of our own", () => {
    expect(toCardDecline(new TypeError("cannot read properties of undefined"))).toBeUndefined();
  });

  function cardError(declineCode: string | undefined) {
    return new Stripe.errors.StripeCardError({
      type: "card_error",
      code: "card_declined",
      message: "Your card was declined",
      ...(declineCode && { decline_code: declineCode })
    });
  }
});
