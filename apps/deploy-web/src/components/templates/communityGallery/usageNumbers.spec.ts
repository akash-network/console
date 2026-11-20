import { describe, expect, it } from "vitest";

import { formatCount, formatStillUp, pluralize } from "./usageNumbers";

describe("usageNumbers", () => {
  describe(formatCount.name, () => {
    it("keeps small numbers whole and shortens large ones to one decimal", () => {
      expect(formatCount(0)).toBe("0");
      expect(formatCount(980)).toBe("980");
      expect(formatCount(1284)).toBe("1.3K");
      expect(formatCount(18400)).toBe("18.4K");
      expect(formatCount(2_100_000)).toBe("2.1M");
    });
  });

  describe(formatStillUp.name, () => {
    it("words a share as a rounded percentage", () => {
      expect(formatStillUp(0.936)).toBe("94% still up after 24 h");
      expect(formatStillUp(1)).toBe("100% still up after 24 h");
      expect(formatStillUp(0)).toBe("0% still up after 24 h");
    });
  });

  describe(pluralize.name, () => {
    it("uses the singular for exactly one", () => {
      expect(pluralize(1, "deploy")).toBe("1 deploy");
    });

    it("uses the plural for none and for many", () => {
      expect(pluralize(0, "fork")).toBe("0 forks");
      expect(pluralize(1284, "deploy")).toBe("1.3K deploys");
    });
  });
});
