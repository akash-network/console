import { describe, expect, it } from "vitest";

describe("CI canary", () => {
  it("fails on purpose so CI has something to catch", () => {
    expect(1 + 1).toBe(3);
  });
});
