import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createInvitationToken, hashInvitationToken, invitationUrl } from "./invitation-token";

describe("invitation token", () => {
  describe(createInvitationToken.name, () => {
    it("returns 32 random bytes encoded as base64url", () => {
      const token = createInvitationToken();

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
    });

    it("returns a different token on every call", () => {
      expect(createInvitationToken()).not.toBe(createInvitationToken());
    });
  });

  describe(hashInvitationToken.name, () => {
    it("returns the sha256 hex digest of the token", () => {
      const token = createInvitationToken();

      expect(hashInvitationToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
      expect(hashInvitationToken(token)).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe(invitationUrl.name, () => {
    it("points at the invitation page of the web console with the token in the fragment", () => {
      expect(invitationUrl("https://console.akash.network", "abc_123")).toBe("https://console.akash.network/invitations#token=abc_123");
    });
  });
});
