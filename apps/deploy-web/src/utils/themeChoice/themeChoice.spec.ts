import { describe, expect, it } from "vitest";

import { rememberThemeChoice } from "./themeChoice";

describe(rememberThemeChoice.name, () => {
  it("keeps the chosen theme in a cookie", () => {
    rememberThemeChoice("dark");

    expect(document.cookie).toContain("theme=dark");
  });

  it("replaces an earlier choice", () => {
    rememberThemeChoice("light");
    rememberThemeChoice("system");

    expect(document.cookie).toContain("theme=system");
    expect(document.cookie).not.toContain("theme=light");
  });
});
