import { afterEach, describe, expect, it, vi } from "vitest";

import { getBrowserLocale } from "./browser-locale";

describe(getBrowserLocale.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the language the browser reports", () => {
    stubBrowserLanguage("fr-CA");

    expect(getBrowserLocale()).toBe("fr-CA");
  });

  it("canonicalizes the casing of the reported language", () => {
    stubBrowserLanguage("en-gb");

    expect(getBrowserLocale()).toBe("en-GB");
  });

  it("drops the modifier of a POSIX locale", () => {
    stubBrowserLanguage("de-DE@posix");

    expect(getBrowserLocale()).toBe("de-DE");
  });

  it("drops the codeset of a POSIX locale and swaps its underscore for a hyphen", () => {
    stubBrowserLanguage("pt_BR.UTF-8");

    expect(getBrowserLocale()).toBe("pt-BR");
  });

  it("falls back to en-US when the browser reports no language", () => {
    stubBrowserLanguage("");

    expect(getBrowserLocale()).toBe("en-US");
  });

  it("falls back to en-US when the reported language is not a locale", () => {
    stubBrowserLanguage("not a locale");

    expect(getBrowserLocale()).toBe("en-US");
  });

  function stubBrowserLanguage(language: string) {
    vi.spyOn(navigator, "language", "get").mockReturnValue(language);
  }
});
