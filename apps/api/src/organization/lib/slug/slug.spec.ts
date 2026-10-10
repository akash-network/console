import { describe, expect, it } from "vitest";

import { MAX_NUMBERED_SLUG_SUFFIX, slugCandidates, toSlug } from "./slug";

describe("slug", () => {
  describe(toSlug.name, () => {
    it("keeps a name that already is a slug", () => {
      expect(toSlug("checkout-api-2")).toBe("checkout-api-2");
    });

    it("lowercases the name and joins its words with a single hyphen", () => {
      expect(toSlug("  Checkout   API__v2 ")).toBe("checkout-api-v2");
    });

    it("drops the hyphens a name starts or ends with", () => {
      expect(toSlug("--Checkout API!!")).toBe("checkout-api");
    });

    it("caps the slug at 40 characters", () => {
      expect(toSlug("a".repeat(45))).toBe("a".repeat(40));
    });

    it("gives an empty slug to a name without a letter or number", () => {
      expect(toSlug("!!! ---")).toBe("");
    });
  });

  describe(slugCandidates.name, () => {
    it("tries the slug of the value, then numbered ones, then a random one", () => {
      const candidates = slugCandidates("Web App", "project", () => "f00dcafe");

      expect(candidates).toEqual(["web-app", ...range(2, MAX_NUMBERED_SLUG_SUFFIX).map(suffix => `web-app-${suffix}`), "web-app-f00dcafe"]);
    });

    it("shortens a long slug so every suffix fits in 40 characters without a doubled hyphen", () => {
      const candidates = slugCandidates(`${"a".repeat(37)} bcd`, "project", () => "f00dcafe");

      expect(candidates[0]).toBe(`${"a".repeat(37)}-bc`);
      expect(candidates[1]).toBe(`${"a".repeat(37)}-2`);
      expect(candidates[MAX_NUMBERED_SLUG_SUFFIX - 1]).toBe(`${"a".repeat(37)}-${MAX_NUMBERED_SLUG_SUFFIX}`);
      expect(candidates[MAX_NUMBERED_SLUG_SUFFIX]).toBe(`${"a".repeat(31)}-f00dcafe`);
      expect(candidates.every(candidate => candidate.length <= 40)).toBe(true);
    });

    it("starts a value without a letter or number from the fallback prefix and a random suffix", () => {
      const suffixes = ["1a2b3c4d", "5e6f7a8b"];

      const candidates = slugCandidates("プロジェクト", "project", () => suffixes.shift()!);

      expect(candidates[0]).toBe("project-1a2b3c4d");
      expect(candidates[1]).toBe("project-1a2b3c4d-2");
      expect(candidates[MAX_NUMBERED_SLUG_SUFFIX]).toBe("project-1a2b3c4d-5e6f7a8b");
    });

    it("draws an 8 hex character random suffix by default", () => {
      const candidates = slugCandidates("web", "project");

      expect(candidates[MAX_NUMBERED_SLUG_SUFFIX]).toMatch(/^web-[0-9a-f]{8}$/);
    });
  });

  function range(from: number, to: number) {
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  }
});
