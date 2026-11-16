import { describe, expect, it } from "vitest";

import { findIncompletePaymentMethodDetail } from "./incompletePaymentMethodDetail";

describe(findIncompletePaymentMethodDetail.name, () => {
  it.each([
    ["incomplete_email", "link_email"],
    ["incomplete_email_autofill", "link_email"],
    ["incomplete_phone_number", "link_phone"],
    ["incomplete_link_sign_in", "link_verification"],
    ["incomplete_payment_method", "link_saved_payment_method"],
    ["incomplete_payment_details", "payment_details"]
  ])("finds what to finish in the payment method for %s", (code, detail) => {
    expect(findIncompletePaymentMethodDetail({ type: "validation_error", code })).toBe(detail);
  });

  it.each(["incomplete_number", "incomplete_cvc", "incomplete_expiry", "incomplete_address", "incomplete_name", "email_invalid", "constructor"])(
    "finds nothing to finish in the payment method for another validation code %s",
    code => {
      expect(findIncompletePaymentMethodDetail({ type: "validation_error", code })).toBeUndefined();
    }
  );

  it("finds nothing to finish in the payment method for a validation error without a code", () => {
    expect(findIncompletePaymentMethodDetail({ type: "validation_error" })).toBeUndefined();
  });

  it("finds nothing to finish in the payment method when the error is not a validation error", () => {
    expect(findIncompletePaymentMethodDetail({ type: "invalid_request_error", code: "incomplete_link_sign_in" })).toBeUndefined();
    expect(findIncompletePaymentMethodDetail({ type: "card_error", code: "incomplete_email" })).toBeUndefined();
  });
});
