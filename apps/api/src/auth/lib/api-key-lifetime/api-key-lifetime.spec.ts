import { describe, expect, it } from "vitest";

import { getDefaultApiKeyExpiry, isWithinMaxApiKeyLifetime } from "./api-key-lifetime";

describe("api key lifetime", () => {
  const now = new Date("2026-10-18T12:00:00.000Z");

  describe(getDefaultApiKeyExpiry.name, () => {
    it("expires a key 365 days after it is created", () => {
      expect(getDefaultApiKeyExpiry(now)).toEqual(new Date("2027-10-18T12:00:00.000Z"));
    });
  });

  describe(isWithinMaxApiKeyLifetime.name, () => {
    it("accepts an expiry 365 days out", () => {
      expect(isWithinMaxApiKeyLifetime(new Date("2027-10-18T12:00:00.000Z"), now)).toBe(true);
    });

    it("accepts an expiry from a client whose clock runs up to a day ahead", () => {
      expect(isWithinMaxApiKeyLifetime(new Date("2027-10-19T12:00:00.000Z"), now)).toBe(true);
    });

    it("rejects an expiry past the one-year cap and its clock allowance", () => {
      expect(isWithinMaxApiKeyLifetime(new Date("2027-10-19T12:00:00.001Z"), now)).toBe(false);
    });
  });
});
