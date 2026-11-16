import type { StripeError } from "@stripe/stripe-js";

export type IncompletePaymentMethodDetail = "link_email" | "link_phone" | "link_verification" | "link_saved_payment_method" | "payment_details";

const INCOMPLETE_PAYMENT_METHOD_DETAILS = new Map<string, IncompletePaymentMethodDetail>([
  ["incomplete_email", "link_email"],
  ["incomplete_email_autofill", "link_email"],
  ["incomplete_phone_number", "link_phone"],
  ["incomplete_link_sign_in", "link_verification"],
  ["incomplete_payment_method", "link_saved_payment_method"],
  ["incomplete_payment_details", "payment_details"]
]);

export function findIncompletePaymentMethodDetail(error: Pick<StripeError, "type" | "code">): IncompletePaymentMethodDetail | undefined {
  if (error.type !== "validation_error" || !error.code) return undefined;
  return INCOMPLETE_PAYMENT_METHOD_DETAILS.get(error.code);
}
