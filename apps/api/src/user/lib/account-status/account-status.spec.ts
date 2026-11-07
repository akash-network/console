import { describe, expect, it } from "vitest";

import { type AccountStatus, type AccountStatusAction, createAccountStatusRefusal, nextAccountStatusOf } from "./account-status";

describe("account status", () => {
  describe(nextAccountStatusOf.name, () => {
    it.each<[AccountStatus, AccountStatusAction, AccountStatus]>([
      ["active", "suspend", "suspended"],
      ["suspended", "reinstate", "active"],
      ["active", "terminate", "terminated"],
      ["suspended", "terminate", "terminated"]
    ])("moves a %s account to %s on %s", (current, action, expected) => {
      expect(nextAccountStatusOf(current, action)).toBe(expected);
    });

    it.each<[AccountStatus, AccountStatusAction]>([
      ["suspended", "suspend"],
      ["terminated", "suspend"],
      ["active", "reinstate"],
      ["terminated", "reinstate"],
      ["terminated", "terminate"]
    ])("refuses to move a %s account on %s", (current, action) => {
      expect(nextAccountStatusOf(current, action)).toBeUndefined();
    });
  });

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
