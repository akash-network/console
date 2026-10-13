import { describe, expect, it } from "vitest";

import { emailRecipientUserId } from "./email-recipient-user-id";

describe(emailRecipientUserId.name, () => {
  it("returns a version 8 uuid with the RFC 4122 variant", () => {
    expect(emailRecipientUserId("support@akash.network")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("returns the same id for the same address", () => {
    expect(emailRecipientUserId("support@akash.network")).toBe(emailRecipientUserId("support@akash.network"));
  });

  it("ignores case and surrounding whitespace in the address", () => {
    expect(emailRecipientUserId("  Support@Akash.Network ")).toBe(emailRecipientUserId("support@akash.network"));
  });

  it("returns a different id for a different address", () => {
    expect(emailRecipientUserId("sales@akash.network")).not.toBe(emailRecipientUserId("support@akash.network"));
  });

  it("derives the id from the sha256 digest of the address", () => {
    expect(emailRecipientUserId("support@akash.network")).toBe("f934d9e8-b4e3-8035-accb-cda9f04e97dc");
  });
});
