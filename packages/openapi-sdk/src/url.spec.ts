import { describe, expect, it } from "vitest";

import { buildUrl } from "./url";

describe("buildUrl", () => {
  it("substitutes path params", () => {
    expect(buildUrl("https://api", "/v1/items/{id}", { id: 7 }, undefined)).toBe("https://api/v1/items/7");
  });

  it("encodes path params", () => {
    expect(buildUrl("https://api", "/v1/items/{id}", { id: "a/b c" }, undefined)).toBe("https://api/v1/items/a%2Fb%20c");
  });

  it("throws on missing path param", () => {
    expect(() => buildUrl("https://api", "/v1/items/{id}", {}, undefined)).toThrow(/missing path param: id/);
  });

  it("appends query params", () => {
    expect(buildUrl("https://api", "/v1/items", undefined, { q: "hello", n: 3 })).toBe("https://api/v1/items?q=hello&n=3");
  });

  it("appends array query params", () => {
    expect(buildUrl("https://api", "/v1/items", undefined, { tag: ["a", "b"] })).toBe("https://api/v1/items?tag=a&tag=b");
  });

  it("skips null/undefined query params", () => {
    expect(buildUrl("https://api", "/v1/items", undefined, { a: null, b: undefined, c: 1 })).toBe("https://api/v1/items?c=1");
  });

  it("strips trailing slash from baseUrl", () => {
    expect(buildUrl("https://api/", "/v1/items", undefined, undefined)).toBe("https://api/v1/items");
  });

  it("supports empty baseUrl (relative URL)", () => {
    expect(buildUrl("", "/v1/items", undefined, undefined)).toBe("/v1/items");
  });
});
