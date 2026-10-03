import { describe, expect, it } from "vitest";

import { getApiKeyExpiryDate, getApiKeyExpiryStatus } from "./apiKeyExpiry";

const NOW = new Date("2026-10-02T12:00:00.000Z");

describe("apiKeyExpiry", () => {
  describe(getApiKeyExpiryDate.name, () => {
    it("adds the lifetime in days to now", () => {
      const now = new Date(2026, 9, 2, 12);

      expect(getApiKeyExpiryDate(30, now)).toEqual(new Date(2026, 10, 1, 12));
      expect(getApiKeyExpiryDate(365, now)).toEqual(new Date(2027, 9, 2, 12));
    });
  });

  describe(getApiKeyExpiryStatus.name, () => {
    it("returns never when the key has no expiry", () => {
      expect(getApiKeyExpiryStatus(null, NOW)).toBe("never");
    });

    it("returns expired when the expiry has passed", () => {
      expect(getApiKeyExpiryStatus("2026-10-02T11:59:59.000Z", NOW)).toBe("expired");
    });

    it("returns expired when the key expires at this exact moment", () => {
      expect(getApiKeyExpiryStatus(NOW.toISOString(), NOW)).toBe("expired");
    });

    it("returns expiringSoon when the key expires within 7 days", () => {
      expect(getApiKeyExpiryStatus("2026-10-02T12:00:01.000Z", NOW)).toBe("expiringSoon");
      expect(getApiKeyExpiryStatus("2026-10-09T12:00:00.000Z", NOW)).toBe("expiringSoon");
    });

    it("returns active when the key expires more than 7 days out", () => {
      expect(getApiKeyExpiryStatus("2026-10-10T12:00:00.000Z", NOW)).toBe("active");
    });
  });
});
