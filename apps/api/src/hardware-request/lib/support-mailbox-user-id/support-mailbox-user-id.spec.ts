import { describe, expect, it } from "vitest";

import { supportMailboxUserId } from "./support-mailbox-user-id";

describe(supportMailboxUserId.name, () => {
  it("returns a version 8 uuid with the RFC 4122 variant", () => {
    expect(supportMailboxUserId("support@akash.network")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("returns the same id for the same address", () => {
    expect(supportMailboxUserId("support@akash.network")).toBe(supportMailboxUserId("support@akash.network"));
  });

  it("ignores case and surrounding whitespace in the address", () => {
    expect(supportMailboxUserId("  Support@Akash.Network ")).toBe(supportMailboxUserId("support@akash.network"));
  });

  it("returns a different id for a different address", () => {
    expect(supportMailboxUserId("sales@akash.network")).not.toBe(supportMailboxUserId("support@akash.network"));
  });

  it("derives the id from the sha256 digest of the address", () => {
    expect(supportMailboxUserId("support@akash.network")).toBe("f934d9e8-b4e3-8035-accb-cda9f04e97dc");
  });
});
