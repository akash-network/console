import { describe, expect, it } from "vitest";

import { toSameOriginPath } from "./toSameOriginPath";

describe(toSameOriginPath.name, () => {
  const origin = "https://console.akash.network";

  it.each(["/", "/graph/daily-akt-spent", "/blocks?page=2", "/blocks?page=2#latest"])("keeps the path %s as it is", value => {
    expect(toSameOriginPath(value, origin)).toBe(value);
  });

  it("keeps only the path of an absolute url on the same origin", () => {
    expect(toSameOriginPath("https://console.akash.network/blocks?page=2#latest", origin)).toBe("/blocks?page=2#latest");
  });

  it("resolves dot segments that stay on the same origin", () => {
    expect(toSameOriginPath("/blocks/../transactions", origin)).toBe("/transactions");
  });

  it("matches the origin of a full page url", () => {
    expect(toSameOriginPath("/blocks", "https://console.akash.network/maintenance?return=%2Fblocks")).toBe("/blocks");
  });

  it.each([
    "https://other.example/phish",
    "http://console.akash.network/blocks",
    "//other.example/phish",
    "/\\other.example/phish",
    "/.//other.example/phish",
    "/..//other.example/phish",
    "/x/..//other.example/phish",
    "/./\\other.example/phish",
    "https://console.akash.network//other.example/phish",
    "/\t/other.example",
    "/\n/other.example",
    "/\r/other.example",
    "javascript:alert(1)"
  ])("rejects %j", value => {
    expect(toSameOriginPath(value, origin)).toBeUndefined();
  });

  it("throws on a value that is not a url", () => {
    expect(() => toSameOriginPath("http://[", origin)).toThrow(TypeError);
  });
});
