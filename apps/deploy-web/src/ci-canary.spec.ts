import { describe, expect, it } from "vitest";

describe("CI canary", () => {
  it("passes", () => {
    expect(1 + 1).toBe(2);
  });
});
