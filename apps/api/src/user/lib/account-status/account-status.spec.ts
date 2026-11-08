import { describe, expect, it } from "vitest";

import { createAccountStatusRefusal } from "./account-status";

describe("account status", () => {
  describe(createAccountStatusRefusal.name, () => {
    it("refuses a suspended account with its code and the reason in the error data", () => {
      const error = createAccountStatusRefusal("suspended", "Unpaid invoices");

      expect(error).toMatchObject({ status: 403, errorCode: "account_suspended", message: "Your account is suspended", data: { reason: "Unpaid invoices" } });
    });

    it("refuses a terminated account with its code and the reason in the error data", () => {
      const error = createAccountStatusRefusal("terminated", null);

      expect(error).toMatchObject({ status: 403, errorCode: "account_terminated", message: "Your account has been terminated", data: { reason: null } });
    });
  });
});
