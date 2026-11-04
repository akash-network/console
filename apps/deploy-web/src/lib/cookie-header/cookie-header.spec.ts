import { describe, expect, it } from "vitest";

import { readCookieEntries } from "./cookie-header";

describe(readCookieEntries.name, () => {
  it("returns every cookie in the order the header lists them", () => {
    expect(readCookieEntries("theme=dark; console_org=acme-corp")).toEqual([
      { name: "theme", value: "dark" },
      { name: "console_org", value: "acme-corp" }
    ]);
  });

  it("keeps each entry of a name the header lists twice", () => {
    expect(readCookieEntries("console_org=acme-corp;console_org=globex")).toEqual([
      { name: "console_org", value: "acme-corp" },
      { name: "console_org", value: "globex" }
    ]);
  });

  it("keeps an equals sign inside the value", () => {
    expect(readCookieEntries("appSession=abc==; theme=dark")).toEqual([
      { name: "appSession", value: "abc==" },
      { name: "theme", value: "dark" }
    ]);
  });

  it("keeps an empty value", () => {
    expect(readCookieEntries("console_org=")).toEqual([{ name: "console_org", value: "" }]);
  });

  it("skips a part without an equals sign", () => {
    expect(readCookieEntries("theme=dark; ; stray")).toEqual([{ name: "theme", value: "dark" }]);
  });

  it("returns nothing without a cookie header", () => {
    expect(readCookieEntries(undefined)).toEqual([]);
    expect(readCookieEntries(null)).toEqual([]);
  });
});
