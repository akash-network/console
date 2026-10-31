import { describe, expect, it } from "vitest";

import { MAX_VARCHAR_LENGTH, toStorableText, toStorableVarchar } from "./chain-string";

describe("chain-string", () => {
  describe(toStorableText.name, () => {
    it("removes every NUL character", () => {
      expect(toStorableText("\0memo\0 text\0")).toBe("memo text");
    });

    it("removes lone high and low surrogates", () => {
      expect(toStorableText("a\uD800b\uDC00c")).toBe("abc");
    });

    it("keeps characters made of a surrogate pair", () => {
      expect(toStorableText("gpu 🚀")).toBe("gpu 🚀");
    });

    it("does not shorten long values", () => {
      const value = "a".repeat(MAX_VARCHAR_LENGTH + 10);

      expect(toStorableText(value)).toBe(value);
    });

    it("returns undefined for an absent value", () => {
      expect(toStorableText(undefined)).toBeUndefined();
    });
  });

  describe(toStorableVarchar.name, () => {
    it("caps a value at the varchar column length", () => {
      expect(toStorableVarchar("a".repeat(300))).toBe("a".repeat(MAX_VARCHAR_LENGTH));
    });

    it("keeps a value of exactly the column length", () => {
      const value = "b".repeat(MAX_VARCHAR_LENGTH);

      expect(toStorableVarchar(value)).toBe(value);
    });

    it("counts a surrogate pair as one character, as Postgres does", () => {
      const value = "🚀".repeat(MAX_VARCHAR_LENGTH + 1);

      expect(toStorableVarchar(value)).toBe("🚀".repeat(MAX_VARCHAR_LENGTH));
    });

    it("removes NUL characters before capping", () => {
      expect(toStorableVarchar(`\0${"c".repeat(MAX_VARCHAR_LENGTH)}`)).toBe("c".repeat(MAX_VARCHAR_LENGTH));
    });

    it("returns undefined for an absent value", () => {
      expect(toStorableVarchar(undefined)).toBeUndefined();
    });
  });
});
