import { describe, expect, it } from "vitest";

import { containsPattern } from "./like-pattern";

describe(containsPattern.name, () => {
  it("matches the text anywhere in the value", () => {
    expect(containsPattern("web")).toBe("%web%");
  });

  it("escapes the wildcards and the escape character so each matches only itself", () => {
    expect(containsPattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
  });

  it("escapes every occurrence rather than the first alone", () => {
    expect(containsPattern("%%__")).toBe("%\\%\\%\\_\\_%");
  });
});
