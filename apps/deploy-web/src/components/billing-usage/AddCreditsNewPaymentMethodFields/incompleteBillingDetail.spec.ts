import { describe, expect, it } from "vitest";

import { findIncompleteBillingDetail } from "./incompleteBillingDetail";

describe(findIncompleteBillingDetail.name, () => {
  it.each(["incomplete_address", "incomplete_address_line1", "incomplete_address_postal_code", "incomplete_address_state"])(
    "finds the billing address incomplete for %s",
    code => {
      expect(findIncompleteBillingDetail({ type: "validation_error", code })).toBe("address");
    }
  );

  it.each(["incomplete_name", "incomplete_first_name", "incomplete_last_name"])("finds the billing name incomplete for %s", code => {
    expect(findIncompleteBillingDetail({ type: "validation_error", code })).toBe("name");
  });

  it.each(["incomplete_number", "incomplete_cvc", "incomplete_zip", "incomplete_card_name", "incomplete_addressee", "unexpected"])(
    "finds no incomplete billing detail for another validation code %s",
    code => {
      expect(findIncompleteBillingDetail({ type: "validation_error", code })).toBeUndefined();
    }
  );

  it("finds no incomplete billing detail for a validation error without a code", () => {
    expect(findIncompleteBillingDetail({ type: "validation_error" })).toBeUndefined();
  });

  it("finds no incomplete billing detail when the error is not a validation error", () => {
    expect(findIncompleteBillingDetail({ type: "invalid_request_error", code: "incomplete_address" })).toBeUndefined();
    expect(findIncompleteBillingDetail({ type: "card_error", code: "incomplete_name" })).toBeUndefined();
  });
});
