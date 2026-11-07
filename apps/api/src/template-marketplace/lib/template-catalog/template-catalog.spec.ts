import { describe, expect, it } from "vitest";

import { MAX_TEMPLATE_CATEGORIES, TEMPLATE_CATEGORIES, TEMPLATE_ICONS } from "./template-catalog";

describe("template catalog", () => {
  it("lists every category the gallery builds itself", () => {
    expect(TEMPLATE_CATEGORIES).toContain("Blockchain");
  });

  it("lists categories sorted and without repeats", () => {
    expect([...TEMPLATE_CATEGORIES]).toEqual([...new Set(TEMPLATE_CATEGORIES)].sort());
  });

  it("offers more categories than a template may carry", () => {
    expect(TEMPLATE_CATEGORIES.length).toBeGreaterThan(MAX_TEMPLATE_CATEGORIES);
  });

  it("offers 24 distinct icons, starting with the fallback", () => {
    expect(new Set(TEMPLATE_ICONS).size).toBe(24);
    expect(TEMPLATE_ICONS[0]).toBe("box");
  });

  it("keeps icon ids within the icon column's 32 characters", () => {
    for (const icon of TEMPLATE_ICONS) {
      expect(icon.length).toBeLessThanOrEqual(32);
    }
  });
});
