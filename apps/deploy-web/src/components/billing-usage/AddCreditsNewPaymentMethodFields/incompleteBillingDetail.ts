import type { StripeError } from "@stripe/stripe-js";

export type IncompleteBillingDetail = "address" | "name";

const INCOMPLETE_ADDRESS_CODE = "incomplete_address";

/** The Address Element reports a blank address part as `incomplete_address_<part>`, such as `incomplete_address_postal_code`. */
const INCOMPLETE_ADDRESS_PART_CODE_PREFIX = `${INCOMPLETE_ADDRESS_CODE}_`;

const INCOMPLETE_NAME_CODES = ["incomplete_name", "incomplete_first_name", "incomplete_last_name"];

export function findIncompleteBillingDetail(error: Pick<StripeError, "type" | "code">): IncompleteBillingDetail | undefined {
  if (error.type !== "validation_error" || !error.code) return undefined;
  if (error.code === INCOMPLETE_ADDRESS_CODE || error.code.startsWith(INCOMPLETE_ADDRESS_PART_CODE_PREFIX)) return "address";
  if (INCOMPLETE_NAME_CODES.includes(error.code)) return "name";
  return undefined;
}
